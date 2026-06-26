# Round 1 — ShellGuardian (devil's advocate; lens = defend the static shell `[D11]`)

## Summary (one paragraph)

The framework forces a **trilemma** on the brand-seed body read (`layout.tsx:67`): under Draft Mode
that read is uncached and request-time, so it can only **(a) live in `<Suspense>`** → published stays
static but the draft preview **flashes** the theme in, **(b) degrade to the published brand** → no
flash but the editor previews the _wrong_ (old) brand, or **(c) block** → the `blocking-route` error
we have now. There is no fourth door: `use-cache.md §Draft Mode` guarantees the read re-executes
uncached every draft request, and `caching.md` requires uncached prerender-time data to sit in
`<Suspense>` or `use cache`. My job is to stop a clever "conditional" fix from quietly converting the
**published** `/` into a dynamic route or pushing the brand tokens out of the initial HTML bytes.
**The metadata site (`:39`) is NOT the `[D11]` flash path** — it emits `<head>` title/OG, not the
visual theme — so I will not let it drive the design; the **body brand-seed read (`:67`) is the only
`[D11]`-critical site** and must be defended hardest. My grudging-accept: `'use cache'` on
`generateMetadata` (keeps published `<head>` fully static; not the connection-marker), plus a
**`<Suspense>` boundary placed strictly _inside_ `<body>` wrapping only the `ProjectScope` subtree**,
with a non-empty fallback — accepting a **draft-only** theme flash as the price of draft-correct
shell preview. Both must clear the curl-the-raw-HTML verification bar below before anyone trusts them.

---

## The hard line I am defending

`[D11]` = the brand tokens / OKLCH theme must be in the **initial HTML bytes** of the **published**
`GET /`, with no flash and no streaming-in. Operationally that means: published `/` prerenders to a
**static shell** (PPR) whose _raw first-flushed HTML_ (not the post-hydration DOM) already contains
the `ProjectScope` wrapper carrying the brand custom-properties. Any fix that (i) makes published `/`
_unconditionally_ dynamic, (ii) moves a `<Suspense>` fallback to/above `<body>`, or (iii) defers the
brand-seed subtree out of the static shell on the published path is a **regression I will block**.

---

## Fix family 1 — conditional `connection()` dynamic-marker (proposed for the metadata side)

**The sanctioned shape** (`generate-metadata.md §"With Cache Components"`, ~L1254): leave
`generateMetadata` doing its uncached fetch, and add a `DynamicMarker` _component to the page body_
that does `await connection()` **inside** `<Suspense>`. The doc is explicit that the marker "renders
nothing but tells Next.js the page has intentional dynamic content," and "By wrapping it in Suspense,
the static content still prerenders normally."

**How it can break the shell — three concrete ways:**

1. **The verbatim trap in the doc's own example.** The example carries this comment on a top-level
   `await connection()`:

   > `// DO NOT place await connection() here`
   > `// doing so prevents the article tag content from being included in the static shell`
   > And `connection.md` confirms the blast radius: a component that awaits `connection()` is "excluded
   > from prerendering, **along with the rest of its output**." So if anyone "simplifies" by hoisting
   > `await connection()` to the top of `RootLayout` (instead of isolating it in a Suspense-wrapped
   > null marker), the **entire shell — html/body/ProjectScope — leaves the static HTML**. That is the
   > single highest-probability way this fix regresses `[D11]`, and it looks like a harmless refactor.

2. **Making the marker conditional re-introduces the original sin.** To fire the marker only under
   Draft Mode you must branch on `await draftMode()` **at the layout top level, outside any cache
   scope**. But `draftMode()` is a request-time API; reading it un-cached, un-Suspense'd in
   `RootLayout` is _itself_ uncached request-time data accessed during prerender → the exact
   `blocking-route` error (`caching.md`: "Uncached data was accessed outside of `<Suspense>`") on the
   **published** path. So "conditional connection-marker" tends to be **self-defeating**: you cannot
   cheaply learn `isDraft` to gate the marker without the gating read tainting the published shell.

3. **An _unconditional_ marker downgrades published `/` from pure-static to PPR-with-a-hole.** Even
   wrapped correctly in Suspense, an always-on `connection()` adds a request-time segment to every
   published request. PPR will still flush the static shell, so brand tokens _probably_ survive — but
   `/` is no longer a pure static document servable as-is from the edge; it now carries a dynamic
   dependency. For the _shell route_, whose entire value proposition is "static themed HTML from byte
   zero," that is a subtle but real downgrade I want avoided unless proven costless.

**Verdict:** acceptable only if the marker is (a) a Suspense-wrapped `null` component, never a
top-level await, and (b) demonstrably does not move the published `<head>`/brand tokens out of the
static shell. I prefer family 3 for the metadata site precisely to dodge all of this.

---

## Fix family 2 — `<Suspense>`-wrapping the body brand-seed read (`:67`) — the `[D11]` crux

This is the one that actually touches the flash path. PPR semantics: content that is **cached and
fully prerenderable completes at prerender and lands in the static shell — the Suspense fallback is
never shown**; the boundary only "activates" (shows fallback, then streams) when the content _cannot_
complete at prerender. So:

- **Published path (Draft OFF):** `sanityFetch` is cached → the brand seed completes during
  prerender → `ProjectScope` with its brand custom-properties is in the static HTML. **No flash.** ✓
  _Provided_ the boundary wraps only the subtree, not the document.
- **Draft path (Draft ON):** `use-cache.md §Draft Mode` — the cached read re-executes **uncached**
  every request, so it _cannot_ complete at prerender → the boundary streams → fallback paints first,
  then `ProjectScope` swaps in the real brand. **This is a flash — but only inside the editor's
  Presentation iframe, never for the public.**

**How it can break the published shell (the things I will not let slide):**

1. **Empty fallback at/above `<body>` deletes the whole shell.** `caching.md §"Opting out of the
static shell"` is unambiguous: a `<Suspense fallback={null}>` wrapping `<body>` in the root layout
   "causes the entire app to defer to request time… there is no static shell to send immediately, so
   every request blocks until the page is fully rendered." If a teammate, trying to cover _both_ read
   sites with one boundary, wraps high (around `<html>`/`<body>`), they nuke `[D11]` for **every**
   published visitor. The boundary MUST sit **inside `<body>`**, wrapping only `ProjectScope`'s
   children-subtree, with a **non-empty** fallback (render the shell scaffold/nav).

2. **A null/blank fallback re-creates the flash you were avoiding — under draft.** Even placed
   correctly, if the fallback renders unstyled/no-brand, the draft preview flashes fallback-palette →
   brand. That's tolerable _only_ because it's draft-only. If the same boundary somehow activates on
   the published path (e.g., the read silently became uncached — a `cacheLife` regression, a client
   swap), the public sees the flash. So the verification bar must prove the published read stays
   cached.

3. **Collateral: the load-bearing import order.** `layout.tsx:3-10` pins
   `foundation.css → globals.css → next/font` ordering (the `@layer` cascade-inversion guard,
   `[D12]/[D27]`, enforced by `layout.import-order.test.ts`). Any "restructuring" to introduce the
   boundary that reorders these imports trades the draft bug for a published cascade inversion — a
   worse `[D11]` regression. Restructuring fixes inherit this risk; minimal in-place Suspense does not.

**Verdict:** the **only** option that is simultaneously published-static AND draft-correct. The draft
flash is the irreducible cost the framework imposes (see trilemma).

---

## Fix family 3 — `'use cache'` on `generateMetadata`

`generate-metadata.md` sanctions this for metadata that "depends on external data but **not** runtime
data." Honest caveat: our `siteSettings` _does_ vary by request (published vs draft client via
`draftMode()` inside `sanityFetch`), so we're at the edge of that conditional. But under
`use-cache.md §Draft Mode` all cached fns re-execute uncached under draft anyway, so wrapping
`generateMetadata` in `'use cache'` should both (a) suppress the `blocking-route` error and (b)
re-execute fresh under draft.

**Why I, the shell-defender, PREFER this over the connection-marker for the metadata site:** it keeps
published metadata **fully prerendered in the static `<head>`** (cached → completes at prerender),
whereas a "intentional dynamic" connection-marker invites Next to **stream** metadata even on the
published path. Static `<head>` > streamed `<head>` for a shell that wants to be static from byte
zero. **But:** this fixes _only_ the metadata site; it does **nothing** for the body read at `:67`.
Anyone who "fixes" with `'use cache'` alone and stops will move the error to `RootLayout (:67/69)`
exactly as the ground-truth doc proved. **It is half a fix, and the half it skips is the `[D11]` half.**

---

## Pressure-test: is "just degrade the shell under draft" acceptable?

**As the final answer: NO — disqualified by the stated requirement.** `00-context.md` and `[D16]`
require draft preview to work for **ALL** content **including** siteSettings/the shell. If under draft
the brand seed (and title) fall back to **published** values, then an editor changing
`siteSettings.brandColor` and opening Preview sees the **old** color — preview does not reflect the
edit. That is preview being _incorrect for the shell_, which is the precise thing Phase 3 must
deliver and Phase 4 depends on. The `<Suspense>` option (family 2) is strictly better on the
requirement: it shows the **correct draft brand** after a flash; degrade shows the **wrong brand**
with no flash. Correct-with-flash beats wrong-without-flash for an editor preview.

**As a pragmatic interim: defensible only if explicitly fenced** — (i) documented as a known gap in
`decisions.md`, (ii) shipped solely to unblock the Phase-4 prerequisite, (iii) justified by
siteSettings edits being rare vs project/note edits, and (iv) carrying a tracked follow-up to the
Suspense fix. It is **not** "done"; it is a labelled IOU. I would accept it under protest only if the
Suspense fix proved to carry published-shell risk we couldn't retire in time — and per family 2 it
doesn't, so I don't see the justification.

---

## The verification bar (must pass on the PUBLISHED path _before_ we trust any fix)

The prior session's "worktree verification trap" = a fix that "worked" against a synthetic condition
that didn't reproduce the real one. So: reproduce the **real** Draft Mode (set the actual
`__prerender_bypass` cookie via the draft-mode route handler, not a hand-toggled flag), and inspect
**raw HTML bytes** (`curl`, never the browser DOM — the browser shows post-hydration state and will
lie that the shell is static).

**Published path — ALL must hold:**

1. `pnpm build` summary marks `/` as a prerendered/static-shell route (PPR), **not** `ƒ (Dynamic)`.
2. `curl -s http://localhost:3000/` → the **first-flushed** HTML (before any streaming `<template>`/
   Suspense boundary marker) contains the **brand custom-property values** on the `ProjectScope`
   wrapper (the real OKLCH brand token). If the brand tokens appear only _after_ a Suspense/streaming
   marker, the shell **regressed** — fail.
3. Same `curl` → `<head>` contains the real `<title>`/OG (metadata prerendered, not streamed).
4. Build log + published runtime log: **zero** `blocking-route` errors.
5. **Regression diff:** the brand-token region of the published `curl` output is equivalent
   **before and after** the change. The fix must not relocate brand tokens out of the static shell.

**Draft path — then, and only then:** 6. With the real bypass cookie, `GET /` returns **200** (no `blocking-route` error). 7. The response reflects the **edited draft** siteSettings — both title and brand color — confirming
preview is _correct_ for the shell (a draft-only flash is acceptable; wrong/published values are not).

**Collateral guard:** `layout.import-order.test.ts` stays green (import order untouched).

---

## The fix I'd grudgingly accept as lowest-risk to the published shell

**Body read (`:67`, the `[D11]` site):** an in-place `<Suspense>` boundary **inside `<body>`**
wrapping **only** the `ProjectScope` subtree, **non-empty fallback** (shell scaffold), no import
reorder. Published stays static (cached completes at prerender); draft streams the correct brand with
a flash confined to the editor iframe. This is the only option that is both published-safe and
draft-correct, and it is the _minimal_ change (no restructuring, no multiple-root-layouts).

**Metadata read (`:39`):** `'use cache'` on `generateMetadata` — keeps the published `<head>`
**fully static** (unlike the connection-marker, which risks streaming it), and re-executes fresh
under draft.

**The single test that would convince me:** verification-bar step 2 + step 5 together — a `curl` of
the **published** `/` whose raw first-flush HTML carries the brand OKLCH token in the `ProjectScope`
wrapper, **byte-equivalent before and after the change**, with `pnpm build` still classifying `/` as
a static-shell route. If that holds AND step 6/7 show a 200 draft response reflecting the edited
brand, I withdraw my objection.

**The two proposals I will hard-block:** (a) any `await connection()` at `RootLayout` top level, or
any `<Suspense>` at/above `<body>` (`caching.md` + `connection.md`: both delete the static shell);
(b) `'use cache'` on `generateMetadata` shipped _alone_ as "the fix" (it leaves the `[D11]` body site
broken — the error just moves to `:67`).

---

### Citations (verified against bundled docs, Next 16.2.9)

- `generate-metadata.md §"With Cache Components"` (~L1254): two sanctioned options (`'use cache'` on
  the metadata fn; or `connection()` `DynamicMarker` inside `<Suspense>`); verbatim "DO NOT place
  await connection() here / doing so prevents the article tag content from being included in the
  static shell"; "By wrapping it in Suspense, the static content still prerenders normally."
- `caching.md §"Opting out of the static shell"` (~L300): empty-fallback `<Suspense>` above `<body>`
  → "there is no static shell to send immediately, so every request blocks until the page is fully
  rendered." Plus the `blocking-route` error text (~L292).
- `connection.md`: `await connection()` "prerendering stops here"; component is "excluded from
  prerendering, along with the rest of its output."
- `use-cache.md §"Draft Mode"` (L215-219): under Draft Mode "all cached functions and components
  re-execute on every request, and results are not saved to the cache"; `draftMode().isEnabled` is
  readable inside `use cache`, but `cookies()`/`headers()` are not.
- `[D11]` flash-free static themed shell; `[D16]` draft-mode design (`getClient(isDraft)`, preview
  for all content incl. shell); `[D9]` `resolveScope`/`ProjectScope` is total, never throws on bad seed.
