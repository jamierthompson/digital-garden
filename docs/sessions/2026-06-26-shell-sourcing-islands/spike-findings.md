# Spike findings — synchronous-constant shell (feat/shell-sourcing)

> **OUTCOME NOTE:** these controls were run while the decision was still the (ii) **code-config**
> verdict. They are what **reversed** it to **Path A** (the flash is dev-only; the Branch-2 blocker
> doesn't exist) — see [`synthesis.md` §0](./synthesis.md). So where the "Net" section below says
> "Decision: code config / `siteSettings` dissolves," read that as the **superseded mid-point**; the
> _findings_ (dev-only flash, refuted claims, Control D) are what stand and feed Path A.

> Empirical validation of the §6 plan in [`synthesis.md`](./synthesis.md), run on a **production
> build + draft cookie** (`pnpm build && pnpm start`, throwaway `/api/spike-draft` route to flip the
> `__prerender_bypass` cookie, `sanityFetch` traced with `console.error`). Draft confirmed active via
> the `Exit preview` marker + `Cache-Control: private, no-cache` header. **All edits reverted.**
>
> Two passes: a first synchronous-shell spike (below), then — prompted by the driver's question "did
> you test the _current_ implementation on prod+draft?" — three **controls** (A/B/C) that corrected two
> of my own conclusions. Read the controls; they supersede the first pass where they conflict.

## Confirmed (synchronous-constant shell)

1. **Builds green; flash-free by construction; content stays live.** Synchronous shell + constant
   metadata: all routes 200 baseline + draft; brand `<style>` + `--brand-*` ramp in the **initial
   HTML**; **zero `siteSettings` reads**; only `project`/`note` content queries re-execute under draft.
   No fallback exists ⇒ the [D28] React-19 de-dup hazard is structurally gone.
2. **Target structure validated** (shell _above_ the boundary; `<Suspense>` around `{children}`;
   `generateMetadata` reads the constant): clean on all routes, content still live under draft.

## Control A — the current (unmodified) implementation on prod + draft

The baseline I'd skipped. Current impl = async `ShellTheme` reading `siteSettings`, async
`generateMetadata`, the load-bearing `<Suspense>` + unthemed `ShellThemeFallback`, `VisualEditingControls`.

- **All routes 200 baseline AND draft.** The `siteSettings` read re-executes once per draft request
  (the two call sites — `ShellTheme` + `generateMetadata` — **dedupe** via `use cache`, as the layout
  comment claims; confirmed by the trace: 1 execution per draft route, 0 on baseline).
- **No unbranded flash on prod — even for the current implementation.** In _both_ baseline and draft,
  the served bytes have the brand `<style data-href="project-theme-garden">` (full `--brand-*` ramp) in
  `<head>` (byte ~501) **and** the first body content is the _resolved themed_ `<div
data-project="garden">` wrapper (byte ~14.6k). The unthemed `ShellThemeFallback` **never appears in
  the served HTML**. PPR serves the build-time-resolved themed static shell; the draft read reconciles
  behind it. (The one `<!--$!-->` boundary marker is benign — `VisualEditingControls` doing
  `BAILOUT_TO_CLIENT_SIDE_RENDERING` for its client overlay, right before "Exit preview".)

**Consequence — corrects the framing.** The flash the whole effort targets is **dev-server-only**;
on prod the current code already paints branded from frame one (this re-measures and confirms the
handoff's "prod = 0 frames"). So the synchronous shell is **not a prod flash fix** — there is no prod
flash. Its real value is: **(a)** removes the _dev_ flash, **(b)** deletes the wrong shape (fallback +
Suspense-for-the-shell + the de-dup hazard + the per-request read of a constant), **(c)** takes the
shell out of the Sanity read-path. The decision rests on **shape + hermeticity + never-edited**, _not_
a user-visible prod defect. (This is exactly DevilsAdvocate's "do-nothing wins on user impact, loses
on shape" — now measured.)

## Controls B & C — the "Branch-2 lockstep" is REFUTED (and so is a codebase comment)

My first pass guessed the predicted Branch-2 error didn't fire because `VisualEditingControls` (a
`draftMode()`-reading body component) licenses the metadata read. **I tested that guess and it is
wrong.** Both controls use a _synchronous_ `ShellTheme` (so the shell can't be the licenser) + an
_async, draft-aware_ `generateMetadata` reading `siteSettings`:

| Control   | Setup                             | `/`, `/about` under draft      |
| --------- | --------------------------------- | ------------------------------ |
| (Phase A) | boundary kept, VEC kept           | **200, no error**              |
| **B**     | boundary kept, **VEC removed**    | **200, no error**              |
| **C**     | **boundary removed, VEC removed** | **200, no error**, build green |

So **nothing** was licensing it — neither `VisualEditingControls` nor the `<Suspense>` boundary. The
metadata read re-executes under draft (trace confirms `isEnabled=true`) and simply **does not throw**.

**The real mechanism (best-supported by the controls).** The Branch-2 / "uncached data outside
`<Suspense>`" errors are **prerender/build-time** determinations. The metadata read is `use cache`:
at **build** (draft off) it is _cached_ → resolves → the route prerenders fully → no deferral → no
Branch-2; under **draft** the route renders **dynamically** (cache bypassed) → there is no prerender
determination to violate → metadata just streams. The "synchronous shell makes metadata the lone
deferrer → Branch-2" chain never materializes for a `use cache` read. **FrameworkFit's Claim 3 was
over-stated**, and the existing `layout.tsx` comment's _"remove this boundary and `generateMetadata`
throws «Uncached data … outside of `<Suspense>`»"_ is **not what happens** — Control C removed the
boundary and metadata did not throw.

> Scope honestly: Control C used a **synchronous** `ShellTheme`, so it isolates the **metadata** half.
> The comment's claim about the **body** read (an _async_ suspending `ShellTheme` without a Suspense
> ancestor) is a _different_ case I did not reproduce here, and is plausibly still true at
> prerender/build time. I refute only the **metadata** half. The deeper Next internals (why `/work`'s
> async content read also tolerated no boundary under draft) were not exhausted — under draft
> everything renders dynamically, which likely explains it, but I did not prove it.

## Net (what changes, what doesn't)

- **Decision: unchanged.** Shell identity → code config; synchronous shell; `siteSettings` dissolves.
- **Rationale: corrected.** Not "fix a prod flash" (none exists) — it's shape + hermeticity +
  measured-zero-curation. `generateMetadata` reads the constant because **`siteSettings` is deleted**,
  not to dodge Branch-2 (which doesn't fire).
- **QA contract: amended.** Do **not** assert "expect a Branch-2 throw on `/` under draft" — it
  doesn't. Assert: **zero `siteSettings` reads**; all routes 200 under draft; brand in initial HTML
  (computed, both schemes — still owed on the real **Vercel** deploy per the handoff hard rule);
  content (`project`/`note`) still re-reads under draft.
- **Open implementation detail for the slice:** whether the final design still needs `<Suspense>`
  around `{children}`. The synthesis says keep it "for content"; Control C tolerated its absence under
  draft, but the **published** PPR streaming of async content reads (and build-time prerender) may
  still want it. **Verify during the slice + QA — don't assume either way.** (This is a mechanics
  detail owned by the implementation/#2, not the sourcing decision.) → **RESOLVED by Control D, below.**

## Control D — IS the `<Suspense>` boundary load-bearing for the async _body_ read? (yes)

Controls B/C left the body-read half open (they used a _synchronous_ `ShellTheme`). Control D tests the
real thing: the **current async `ShellTheme`** with the `<Suspense>` boundary **removed** (async
`generateMetadata` kept, `VisualEditingControls` kept).

- **Prod build:** green; all routes 200 under draft; siteSettings read fires; brand applied. **No error.**
- **`next dev`:** the blocking-route error **fires** — `Error: Route "/": Uncached data or
connection() was accessed outside of <Suspense>` (and `/work`), for the async body read.

**Verdict:** the boundary **IS load-bearing for the async body read.** Remove it and the body read trips
the blocking-route error — surfaced live in `next dev`; a production build prerendered the cached read
(draft off → `use cache` hit), so prod _tolerates_ it, but the shape is wrong. So the `README`/`layout`
claim "the boundary fixes the blocking-route error" is **accurate — for the body read** (it is NOT about
`generateMetadata`, which Control C showed is independently fine). This is the **same dev-vs-prod / PPR
theme as the flash**: dev surfaces the live consequence of an uncached read; prod prerendered past it.
**Implication: keep the `<Suspense>` boundary** (Path A keeps the implementation as-is anyway).

**Stack-frame nuance (QA-sharpened — don't let it fool a future agent).** In `next dev`, the Control-D
blocking-route error's stack frame literally names **`generateMetadata` (layout.tsx:42)**, not the
body-read line — because the un-deferred async body makes the _whole route_ blocking, and
`generateMetadata`'s (also-uncached-under-draft) read is simply where Next reports it. It is NOT
`generateMetadata` failing on its own: with a **synchronous** body (Control C) there is **no**
blocking-route error, only a benign `dynamic-metadata` notice. So "removing the boundary does not make
metadata throw" is precise **only when the body is synchronous/deferred**; in the real async-body code,
boundary removal _does_ surface a throw reported at the `generateMetadata` frame. Restore the boundary
(or make the body synchronous) — don't "fix" metadata.

## Addendum — `[D27]` import-order red-herring experiment (does NOT reproduce)

Separate from shell-sourcing, run this session at the driver's request (the `[D27]` "re-test" tracked in
`build-phases.md`). `[D27]` (PR #23) attributes the app-wide `@layer` cascade inversion to **import
order** (`next/font` before `foundation.css`).

- **Protocol (the `[D27]` repro conditions):** main tree (confirmed not a worktree), **cold `.next`**,
  clean **production** build; move `next/font` **above** the global sheets; observe the `.tag` chip on
  `/work/first-light` — `4px 12px` (correct) vs `0` (inverted), browser-verified computed style.
- **Result:** `4px 12px` (correct) in **baseline AND reordered, warm AND cold** builds. The inversion
  **does not return.**
- **Verdict:** in **Next 16.2.9 the import-order constraint is a red herring.**

### WHY it's a red herring (the mechanism)

First, **what the inversion _is_.** CSS cascade layers rank by the order each layer is **first named**.
`foundation.css:7` declares the order up front: `@layer foundation, brand, project;` → `foundation` <
`brand` < `project` (project wins, as intended — the foundation reset is meant to be out-ranked by
project rules). The "inversion" is when `project` instead ends up the **lowest** layer, so the
foundation reset out-ranks project rules and zeroes them (the `.tag` chip → `padding: 0`). That can
only happen if some `@layer project { … }` block registers `project` **before** `foundation.css`'s
order statement is parsed. (Every component CSS module here declares `@layer project { … }` —
`TagList.module.css`, `ShellNav.module.css`, the page modules, etc. — so the raw material for an
inversion exists; the order statement landing first is what prevents it.)

Now, **why `next/font` is the wrong lever.** `[D27]` blames importing `next/font` _before_
`foundation.css`. But **`next/font` (Geist) emits no `@layer` rules at all** — just `@font-face` + a
class (grep-confirmed). A stylesheet with no layers cannot move any `@layer project` block ahead of
`foundation.css`'s order statement, so **its import position cannot affect `@layer` ordering.** Moving
it (the `[D27]` experiment) changes nothing — which is exactly what the measurement shows. The real
lever for an inversion, if one ever occurs, is whether `foundation.css`'s `@layer foundation, brand,
project;` statement is emitted before any **component** module's `@layer project { }` block — a
chunk-emission-order question about the _global sheets vs component chunks_, **not** about `next/font`.

So `[D27]` most likely **mis-attributed** the original symptom to `next/font` (the import it happened to
move), when the thing that actually mattered was "`foundation.css` (with its order statement) loads
before the component layers" — which holds in 16.2.9 regardless of where `next/font` sits. **Fresh-QA
byte-confirmation:** in **both** orderings (baseline and `next/font`-first), the foundation chunk is the
**first `<head>` stylesheet**, so `@layer foundation, brand, project;` is parsed before any component
`@layer project {` block → `project` stays highest. The mechanism for "no inversion in 16.2.9" is thus
**confirmed at the bytes**, not just inferred. (Honest limit: what's _not_ reconstructed is why the
**original** repro differed — a since-fixed Turbopack chunk-ordering quirk, or the worktree
verification artifact `[D27]` itself flagged. Either way the `next/font`-specific constraint guards
nothing now.)

### How this relates to the site-shell work: it doesn't (they only share a file)

`[D27]` is a **CSS `@layer` cascade-order** concern; the shell `<Suspense>` is a **draft-mode
data-loading** concern — unrelated mechanisms. The _only_ link is co-location in `layout.tsx`: the
`[D27]` load-bearing comment dictates the CSS-import order, and the shell's `Suspense` import was
deliberately parked **after** the CSS imports "so it can't disturb the `[D27]` Turbopack anchor." So
`[D27]` merely _constrains where the shell's import line sits_ — nothing deeper. If `[D27]` is relaxed,
that placement constraint on the `Suspense` import goes away too; the shell behavior is untouched
either way.

**Follow-up (owner's call, own branch):** supersede `[D27]` and relax the constraint (drop the
import-order comment, the contorted `Suspense`-import placement, `layout.import-order.test.ts`) — or keep
it as cheap, harmless insurance. Not done unilaterally (immutable decision).
