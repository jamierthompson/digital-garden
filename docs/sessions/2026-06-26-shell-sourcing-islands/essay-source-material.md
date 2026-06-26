# Essay source material — the shell-flash mystery & the islands model

> Raw material for a visual essay (you write the prose + visuals; this is the accurate, measured
> backbone). Everything here is empirically verified on this repo (Next 16.2.9 / React 19.2.4),
> 2026-06-26. Companion docs: [`synthesis.md`](./synthesis.md) §0 (the decision),
> [`spike-findings.md`](./spike-findings.md) (the controls). Measurements are reproducible with a
> throwaway `/api/draft-mode`-style route that flips the `__prerender_bypass` cookie + `curl`.

---

## 1. The one-paragraph version

A personal site has a shared **shell** (nav + brand: an OKLCH color, a font, a title). In `next dev`,
the very first frame of the shell paints **unthemed** for ~14 ms, then snaps to the brand. In
production it **never** does. For a while that looked like a bug to fix — "the shell fetches a
constant per request; make it a synchronous constant." Measuring it dissolved the whole thing: the
flash is a **dev-server-only** artifact of how `next dev` renders (no prebuild), production is already
flawless because of **Partial Prerendering (PPR)**, and the shell isn't a constant at all — it's an
**editorial island**, exactly like every project. The fix was to _understand_ it, not change it.

---

## 2. The mental model: everything is an "island"

The theming primitive is **`ProjectScope`** (`src/components/project-scope/ProjectScope.tsx`): a
synchronous server component that takes a _seed_ `{ slug, brandColor, fontKey }` and emits

1. a hoisted `<style href="project-theme-<slug>" precedence="brand">` — the OKLCH engine's baked
   `--brand-*` `light-dark()` ramp, in `@layer brand`; and
2. a `<div data-project="<slug>">` wrapper that scopes those vars to its subtree.

Two consumers, **same primitive**:

```
                       ProjectScope (the island primitive)
                      /                                    \
   SHELL ISLAND  slug="garden"                   PROJECT ISLAND  slug="first-light"
   brand from siteSettings                       brand from the project document
   resolved in ShellTheme (root layout)          resolved in WorkPage (the route)
   async + draft-aware Sanity read               async + draft-aware Sanity read
   suspends under draft → root <Suspense>         suspends under draft → loading.tsx
   fallback: unthemed                             fallback: unthemed (plain "Loading…")
   dev: 1 unthemed frame · prod: 0                dev: 1 unthemed frame · prod: 0
```

**They are the same island twice.** This symmetry is the crux of the _architecture_: the site shell is
not special — it's the "garden" island. Each project is its own island. The earlier plan to make the
shell a synchronous **code constant** would have made it the one asymmetric, non-editorial special
case. Keeping it an editorial Sanity island (the chosen **Path A**) preserves the symmetry.

---

## 3. THE CRUX: why dev flashes one frame and prod doesn't

This is the heart of the essay. The shell's brand comes from an **async** read
(`ShellTheme` → `await sanityFetch(SITE_SETTINGS_QUERY)`). An async component **suspends**. What the
visitor sees on the first frame depends entirely on **what fills the suspense while the read resolves** —
and that is different in dev vs prod because of **PPR**.

### Production = there is a build-time prerender

At `next build`, Cache Components **prerenders each route into a static HTML shell**. Draft Mode is OFF
during the build, so `sanityFetch` (which is `use cache`) **hits the cache and resolves** — meaning
`ShellTheme` fully resolves _at build time_ and its **themed** output is **baked into the static
shell**: the brand `<style>` lands in `<head>`, the `<div data-project="garden">` wrapper is the first
body content. At request time the server sends **that prerendered, already-themed HTML first**, then
(under draft) reconciles the live re-read behind it. **First paint is themed. Zero unthemed frames.**

### Dev = there is no prerender

`next dev` has **no build-time prerender** to serve. Each request renders live, so `ShellTheme`'s read
actually suspends _in the request path_, and React streams the **`<Suspense>` fallback first**. That
fallback (`ShellThemeFallback`) is deliberately **unthemed** (§4), so the **first frame is the
unbranded shell**; the themed tree streams in ~14 ms later and replaces it. **One unthemed frame.**

### The measured proof (same page, same draft cookie, dev vs prod)

Byte offset of each marker in the **streamed HTML** of `/`:

| Marker                                              |                                                                       **DEV + draft** |                     **PROD + draft** |
| --------------------------------------------------- | ------------------------------------------------------------------------------------: | -----------------------------------: |
| First `<nav>`                                       | **2,503** — the _unthemed fallback_ (preceded by `<!--$?-->` pending-suspense marker) |           (no fallback in the bytes) |
| Brand `<style>` (`@layer brand` ramp, head-hoisted) |                                                          **62,520** (streams in late) | **501** (in `<head>`, opening bytes) |
| Themed `<div data-project="garden">`                |                                                          **60,641** (streams in late) |      **14,654** (first body content) |
| Net first paint                                     |                                                            unthemed shell → **flash** |          themed shell → **no flash** |

Read it as a timeline: in **dev**, the opening ~60 KB of the response is the _unthemed_ shell (a
pending Suspense boundary), and the brand only arrives at the tail. In **prod**, the brand `<style>` is
in the first ~0.5 KB and the themed wrapper is the first thing in `<body>`. Same component, opposite
first paint — **purely because prod has a prebuild and dev doesn't.**

> One-line essay caption: _"The flash isn't the shell loading slowly — it's dev showing you the
> Suspense fallback that production already resolved at build time."_

---

## 4. Why the fallback is _unthemed_ (the subtlety behind the flash)

You might ask: why not give the dev fallback the brand too, so it never flashes? Because of **React 19
stylesheet de-duplication**. A themed fallback and the real `ShellTheme` would _both_ emit
`<style href="project-theme-garden">`. React hoists `<style precedence>` to `<head>` and **de-dupes by
`href`, keeping the FIRST committed** — which at prerender is the _fallback's_. So a themed fallback
would silently theme the **whole** shell with the engine _fallback_ palette, on **both** the published
build and draft preview. That was a real regression once (commit `bbea62e`, "Item C", pinned by
`src/app/layout.shell-theme-dedup.qa.test.tsx`). The cure: keep the fallback **structural-only**
(boundary + nav, no `ProjectScope`, no brand `<style>`). The price of that cure is exactly the
**dev-only unthemed frame** — a fair trade, since prod never shows the fallback at all.

---

## 5. The plot twist: a predicted error that doesn't exist (Controls A/B/C)

While weighing the (abandoned) "make the shell a synchronous constant" plan, one analysis predicted a
**`generateMetadata` Branch-2 error**: with a synchronous shell, the (still-async) `generateMetadata`
read of `siteSettings` would be the "lone deferrer" on the otherwise-static routes (`/`, `/about`,
`/now`) and throw _"uncached data accessed outside of `<Suspense>`"_ under draft. A spike tested it:

- **Control A** — current implementation, prod build + draft cookie: **no flash** (the §3 measurement),
  all routes 200.
- **Control B** — synchronous shell + async `generateMetadata`, **`VisualEditingControls` removed**:
  all routes **200, no error** under draft.
- **Control C** — same, **`<Suspense>` boundary removed too**: still **200, no error**, build green.

**The predicted error never fires.** Why: Branch-2 / "uncached outside Suspense" are **prerender-time**
determinations. `generateMetadata`'s read is `use cache` → _cached at build_ (so it doesn't defer
during prerender → no build error) and _dynamic under draft_ (so there's no prerender determination to
violate → no request-time error). Two corrections fall out of this:

1. The "synchronous shell forces a `generateMetadata` lockstep" claim was **over-stated** — wrong
   mechanism.
2. The long-standing comment in `src/app/layout.tsx` that the `<Suspense>` boundary _"licenses
   `generateMetadata`"_ and that _"remove this boundary and `generateMetadata` throws"_ is **wrong for
   the metadata read** (Control C removed the boundary; metadata didn't throw). The boundary IS
   load-bearing — but for the async **body** (`ShellTheme`) read, **not** for `generateMetadata`.

> Caveat to keep honest in the essay: Control C used a _synchronous_ `ShellTheme`, so it isolates the
> _metadata_ half. The boundary is still genuinely needed for the async _body_ read (a suspending
> `ShellTheme` with no Suspense ancestor would throw at prerender). We refuted only the metadata half.

---

## 6. The decision journey (good narrative spine)

1. **The itch** (prior sessions): a documented "unbranded shell flash" in draft mode; the shell read
   `siteSettings` per request; it _felt_ like fetching a constant — a wrong shape.
2. **The debate**: a 4-lens agent team (Architect / SanityModel / FrameworkFit / DevilsAdvocate), run
   blind → adversarial → synthesized. It concluded **"shell identity → code config, `siteSettings`
   dissolves"** — a clean, well-argued verdict (trail in `round-1-drafts/`, `round-2/`).
3. **The spike** (measure before building): the flash is **dev-only** (prod already 0 frames); the
   Branch-2 blocker **doesn't exist**. Two of the debate's load-bearing premises fell.
4. **The reframe**: the driver's goal was "build like a team" + an original **islands** vision. Under
   that lens the shell brand is **editorial content, not a constant** — so "wrong shape" dissolves, and
   keeping it live-in-Sanity is what a team wants (and is now known to be framework-legal).
5. **The reversal → Path A**: keep the shell an editorial async island, symmetric with projects. **No
   refactor.** The most coherent answer turned out to be the one already built — the value was the
   _understanding_, not a diff.

Teachable meta-point: the agent team reached a _defensible_ verdict on the _stated_ premises; measuring
the premises (flash dev-only; Branch-2 nonexistent) and restoring the original architectural intent
(islands) flipped it. "Verify, then write" caught it.

---

## 7. Raw numbers & facts (for charts/captions)

- **Flash**: dev ≈ **1 frame / ~14 ms** unthemed; prod **0 frames**. (Slow-4G, per-rAF method in the
  prior session; corroborated here by the HTML-structure byte offsets in §3.)
- **Streamed-HTML byte offsets** (`/`, draft): see §3 table. Dev brand `<style>` @ 62,520 vs prod @ 501.
- **`siteSettings` doc**: `_createdAt 2026-06-24T18:15:37Z`, `_updatedAt …:42Z` (5 s apart → created,
  never edited). title `"Jamie's Digital Garden"`, brandColor `oklch(0.62 0.13 150)`, fontKey
  `"fraunces"`, brandColorDark `null`.
- **`use cache` dedup**: `ShellTheme` and `generateMetadata` both call `sanityFetch(SITE_SETTINGS_QUERY)`
  but it executes **once per request** (same cache key). Verified: 1 execution per draft route, 0 on
  baseline.
- **Symmetry artifacts**: shell fallback = `ShellThemeFallback` (root `<Suspense>`); project fallback =
  `work/[slug]/loading.tsx`. Both unthemed.

---

## 8. Suggested visuals

1. **First-paint filmstrip** — two rows (dev / prod), frame 0 → frame 1. Dev: gray unthemed nav → green
   themed. Prod: green themed → green themed (identical). The "aha" image.
2. **Streamed-HTML ribbon** — a horizontal byte axis (0 → ~65 KB). Mark where the brand `<style>` and
   themed wrapper land: prod near the far left (0.5 KB / 14.6 KB), dev near the far right (60–62 KB).
   Visually: "prod front-loads the brand; dev back-loads it."
3. **The islands diagram** — `ProjectScope` in the center; shell + N projects branching off, each
   labeled "async Sanity read · unthemed fallback · dev-flash · prod-clean." Caption: "the shell is just
   the garden island."
4. **PPR build→serve flow** — build prerenders the _resolved themed_ shell → served first (prod); dev
   has no prebuild → Suspense fallback served first. Side-by-side pipelines.
5. **Decision-journey arrow** — itch → debate (config verdict) → spike (premises fall) → islands reframe
   → Path A. Note that the endpoint equals the starting code.
6. **The de-dup trap** — two `<style href="project-theme-garden">` tags colliding into one, React keeping
   the wrong (fallback) one — why the fallback must stay unthemed.
