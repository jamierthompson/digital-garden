# Phase 0.5 — Walking Skeleton: Render Proofs

> **Status: all four proofs green on the real stack.** Next.js 16.2.9 / React 19.2.4,
> `cacheComponents` on app-wide. This doc is the required deliverable for the Phase 0.5
> checkpoint `[D17]`: it records _what_ was verified and _how_, so the render unknowns are
> retired with evidence rather than assertion. Verdicts are reproducible from the commands
> below.

## What shipped

A stub `ProjectScope` (hardcoded palette + font, **no engine**) themes one hardcoded module
shell rendered through a thin `/work/[slug]` route on the real Next 16 / React 19 build.

| File                                                    | Role                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/components/project-scope/scopeSeed.ts`             | Pure, **defensive** seed→tokens resolver (never throws). Phase 1 swaps in the engine |
| `src/components/project-scope/scopeSeed.test.ts`        | Unit tests for the never-throw contract `[D9]` (9 bad-input cases)                   |
| `src/components/project-scope/ProjectScope.tsx`         | Sync server component: emits scoped `<style precedence>` + `[data-project]` wrapper  |
| `src/components/project-scope/ProjectScope.test.tsx`    | Renders the sync RSC in jsdom; asserts scoping + fallback                            |
| `src/components/project-scope/ProjectScopeBoundary.tsx` | `'use client'` `unstable_catchError` backstop around the scope `[D9]`                |
| `src/app/work/[slug]/page.tsx`                          | Thin route — `await params`, composes the boundary → scope → shell → streamed hole   |
| `src/app/work/[slug]/ModuleShell.tsx` + `.module.css`   | Hardcoded, token-consuming module (CSS Module declares `@layer project` `[D12]`)     |
| `src/app/work/[slug]/StreamedSection.tsx`               | `await connection()` → forces a real streamed dynamic hole (proves PPR + flush)      |

Composition (route): `ProjectScopeBoundary` › `ProjectScope` › `ModuleShell` › `<Suspense>` › `StreamedSection`.

---

## Proof 1 — Defensive `ProjectScope` never throws `[D9]`

**How.** `resolveScope(seed: unknown)` is a total function: every input (`undefined`, `null`,
numbers, bare strings, unknown slugs, non-string slugs, a hostile CSS-injection slug, and a
getter that throws) maps to the neutral fallback palette. The selector it emits is **always a
vetted constant** (`oklch-engine` or `fallback`) — an unknown/hostile slug collapses to
`fallback`, so untrusted input can never reach the `[data-project="…"]` selector or the
`data-project` attribute. The scope is _also_ wrapped at the route in `unstable_catchError`
(`next/error`, introduced v16.2.0; verified against `node_modules/next/dist/.../catchError.md`
and the `'use client'` source in `catch-error.js`) as a last-resort backstop — the correct
containment because a segment `error.tsx` does **not** catch a throw from its own layout, and
the scope wraps content at layout level (§7).

**Verdict: PASS.** 15/15 unit tests green (`pnpm test`). Browser: `/work/does-not-exist`
rendered the fallback theme (`data-project="fallback"`, accent `oklch(0.55 0 0)`,
`<style data-href="project-theme-fallback">`) with **no console errors** — the no-throw path
works end-to-end, not just in jsdom.

> **Note for Phase 1 (real `ProjectScope`):** the never-throw guarantee is the engine's job
> (`resolveScope` → engine call). The `unstable_catchError` fallback **cannot re-render
> children** (the API omits `children` from the fallback props by design), so it shows a
> neutral notice, not the original content unthemed. Keep the engine total — the boundary is
> belt-and-suspenders, not the primary defense.

## Proof 2a — React 19 `<style precedence>` + Suspense flush-before-paint `[D13]`

**The unknown.** Does React 19's special `<style href precedence>` hoist into `<head>` and
flush **before paint** on _this exact_ React version, so a scoped theme has no FOUC even while
the route streams? Not confirmable from the bundled Next docs (it's a React-version behavior).

**How.** `ProjectScope` emits `<style href={`project-theme-${slug}`} precedence="brand">`.
`StreamedSection` does `await connection()`, forcing a genuinely **streamed** dynamic hole
(wrapped in `<Suspense>` — required, else the build errors "uncached data outside Suspense"
`[D11]`). Inspected the **prerendered** HTML and the live DOM.

**Evidence (built `/work/oklch-engine.html`, `pnpm build`):**

- The brand `<style>` is hoisted into `<head>`, **not** `<body>`:
  `<style data-precedence="brand" data-href="project-theme-oklch-engine">` containing
  `@layer brand { [data-project="oklch-engine"] { --brand-accent: oklch(0.62 0.21 264); … --font-face: var(--font-geist-mono), … } }`.
- The streamed sentinel text is **absent** from the static HTML; the `<Suspense>` **fallback**
  ("Loading dynamic section…") is what's baked into the shell. → the themed `<head>` is part
  of the first flush, the dynamic hole arrives later. Build route table confirms PPR:
  `◐ /work/[slug]  (Partial Prerender) prerendered as static HTML with dynamic server-streamed content`.
- Browser (`evaluate_script`): `brandStyleInHead: true`, `brandStyleHasLayerBrand: true`,
  console clean, render flash-free (screenshot reviewed — blue accent + mono face present
  immediately, streamed paragraph appears after).

**Verdict: PASS.** React 19.2.4 hoists `<style precedence>` to `<head>` and de-dupes by
`href`; the theme is in the initial shell HTML before the streamed hole paints — flash-free.
Per `[D13]`, plain inline `<style>` already suffices when the scope is never suspended; the
skeleton deliberately uses the `precedence` form to **retire** the hoisting unknown, and it
holds even under active streaming.

## Proof 2b — The `@layer` trap: unlayered silently outranks every layer `[D12]`

**How (empirical, in-browser).** Injected a probe element plus a stylesheet declaring
`@layer foundation, brand, project;` then **two** competing rules on the probe: an
**unlayered** `color: rgb(0,0,255)` and, _later in source order_, a `@layer project`
`color: rgb(255,0,0)` (project = highest declared layer). Source order was deliberately rigged
to favor the layered rule, so only layer precedence can explain the result. Read back
`getComputedStyle`.

**Evidence:** `trapProbeColor: "rgb(0, 0, 255)"` →
`"UNLAYERED WINS over @layer project (trap confirmed)"`.

**Verdict: PASS.** An unlayered declaration beats a rule in the highest cascade layer
regardless of source order — exactly the trap `[D12]` guards against. Next leaves CSS Modules
unlayered by default, so **every** `*.module.css` must declare its `@layer` or it silently
wins. The one module added here (`ModuleShell.module.css`) declares `@layer project`;
`pnpm lint:css` (green) enforces this repo-wide. Cross-check that the _intended_ layered chain
works: the module's `.title { color: var(--brand-accent) }` (`@layer project`) reads the var
set by the scope's `@layer brand` block → computed `h1` color = `oklch(0.62 0.21 264)`, the
brand accent. Layered cascade resolves correctly.

## Proof 3 — Empirical `<head>` font-preload check `[D11]`

**How.** `pnpm build`, then grep the prerendered HTML for `<link rel="preload" as="font">`.

**Evidence (`.next/server/app/work/oklch-engine.html`):**

- `as="font"` preload links: **0**. The only preload on the route is a JS chunk
  (`<link rel="preload" as="script" …>`).
- Cross-checked the home route (`index.html`): also **0** font preloads.

**Verdict: PASS — `preload:false` policy holds.** No **per-project** font is preloaded: the
stub maps `--font-face` to the already-loaded shell `var(--font-geist-mono)` rather than
importing a new `next/font` face, so nothing new is injected. (Observation for Phase 1: the
shell faces declared `preload: true` in `layout.tsx` also produced no `<link as="font">` in
this static build — `next/font` only emits a targeted preload for a face it can _statically_
see used on a prerendered route. This matches `[D11]` Axis B: a runtime-indexed
`roster[fontKey].variable` can't be targeted for preload. If an above-the-fold project face
ever must preload, emit the `<link rel="preload" as="font" crossorigin>` manually.)

---

## Browser verification `[D25]`

Driven via the `chrome-devtools` MCP against `pnpm dev` (`http://localhost:3000`):

- **`/work/oklch-engine`** — flash-free themed render (blue OKLCH accent, Geist Mono face,
  light brand surface, accent badge + link, streamed section present). Brand `<style>` in
  `<head>` with `@layer brand`; `h1` computed color = `oklch(0.62 0.21 264)`; `main`
  font-family = `"Geist Mono", …`. **Console: clean** (no messages).
- **`/work/does-not-exist`** — fallback theme renders, **no console errors** (no-throw path).
- **`@layer` trap** — confirmed via `evaluate_script` (above).

Screenshot captured and reviewed during the run (full-page, `/work/oklch-engine`): render is
correct and flash-free. (Saved inline in the build transcript — the MCP screenshot tool's
workspace root does not include this worktree, so no PNG is committed.)

## The gate

Full CI chain green in the worktree, in order:

```
pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test \
  && pnpm --filter studio typegen && git diff --exit-code sanity.types.ts && pnpm build
```

`sanity.types.ts` unchanged (no schema touched). Build emits `/work/oklch-engine` (prerendered)
and `◐ /work/[slug]` (Partial Prerender).

---

## Handoff to Phase 1 (real `ProjectScope`, swaps stub palette → engine)

- **Swap point:** `scopeSeed.ts` `PALETTES`/`FALLBACK_TOKENS` → the OKLCH engine
  `(brandColor, scheme) → tokenSet`. Keep `resolveScope` total; the engine must be the
  never-throw layer (its tests already assert this contract — `scopeSeed.test.ts` is the
  template).
- **Keep the selector-safety invariant:** never interpolate an untrusted slug into the emitted
  CSS/`data-project`. The stub guarantees this by collapsing unknown slugs to a constant.
- **`precedence` vs inline:** the `precedence` form is proven and safe under streaming. The
  common case (scope in the prerendered shell, `use cache` keyed on `brandColor`/`fontKey`,
  `cacheLife('max')`) can use plain inline `<style>` per `[D13]`; the skeleton kept the scope
  **sync** (no `use cache`) so it stays jsdom-testable — Phase 1 should add `use cache` once
  the engine lands and decide inline-vs-precedence per where the scope renders.
- **Fonts:** `--font-face` here points at the shell mono var as a stand-in. Phase 1 applies the
  resolved roster face's `.variable` class on the wrapper; keep `preload:false` on roster faces.
- **`unstable_catchError` caveat:** fallback can't re-render children — don't lean on it to
  show content; lean on the total engine.
