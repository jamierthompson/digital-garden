# Decisions Log

ADR-style record of decisions resolved by the architecture audit (see `audit/`).
Each entry: the decision, the status, why, and which plan section it amends. Status
legend: **Decided** (resolved by the debate) · **Open** (needs your call before it
can be locked).

> These amend `architecture-plan.md` / `build-phases.md`. The plan docs are left
> as-authored; this log is the source of truth for the deltas until the plans are
> revised.

---

### D1 — Token model is three tiers, not "complete self-described islands"

**Decided.** Amends §3.1, §1, §8.
Invariant foundation (spacing, motion, breakpoints, z-index, type-scale ratios,
semantic colors) lives at global `:root`. Brand ramp + font are engine-scoped per
`[data-project]`. Feel/geometry (radius, border weight, shadow, density) is a small
scoped override set with defaults inherited from the global tier.
**Why:** only brand, font, and feel actually vary across ~5 projects; re-declaring a
complete foundation per island is cost without benefit and bloats each `<style>`
flush. Rewrite §3.1's rule to "no global **brand/feel** values; invariant foundation
is global."

### D2 — Public token contract is the generic layer; `--logx-*` is an internal alias

**Decided.** Amends §3.1, §3.3, §5, §6.
Shared cross-project units read only generic names (`--brand-*`, `--font-face`,
`--space-*`). `--logx-*` is project-internal, mapped from the generic layer. A shared
embed can't know a project prefix and must not depend on one.

### D3 — Bake `oklch()` literals server-side (resolve the trilemma)

**Decided.** Amends §1, §3.2, §3.3.
The engine emits contrast-solved, gamut-mapped literal values server-side.
Relative-color CSS (`oklch(from …)`) is permitted only for decorative, non-contrast
deltas. Live per-token CSS override is explicitly **not** a goal — no consumer needs
it. Keep `var(--public, var(--_internal-default))` for downward primitive theming
only; drop the "generalizes to the whole system / live re-derivation" claim.

### D4 — Contrast is solved, not stepped

**Decided.** Amends §3.2.
The engine takes a contrast target (APCA Lc for text, WCAG 2.x as compliance
fallback) and binary-searches L for on-brand/on-surface pairs against the relevant
background, evaluated on the **gamut-mapped** color. Fixed lightness offsets are not
acceptable — equal ΔL ≠ equal contrast across hues.

### D5 — Dark mode is in scope from v1; engine signature is `(brandColor, scheme) → tokenSet`

**Decided** (user call, 2026-06-21). Amends §3.2, §6, Phase 1.
The engine is scheme-aware from the start: `(brandColor, scheme) → tokenSet`. A
single `brandColor` per project generates **both** light and dark ramps — dark is
not "invert L" but reduced chroma + shifted surface L with on-color contrast
re-solved per scheme (D4). The scoped `<style>` emits both via CSS `light-dark()`
(baseline 2025) so one block carries both schemes and switching is pure CSS
(`color-scheme`), respecting `prefers-color-scheme` by default. **No per-scheme
field on the doc** (per D16/ContentModel): scheme is a render-time axis, not authored
content. A project needing a hand-tuned dark brand gets an _optional_ `brandColorDark`
override, defaulted from the engine — never a required parallel field. The Phase-1
visual harness (D17) asserts contrast in **both** schemes.

### D6 — Gamut-map before contrast math

**Decided.** Amends §3.2.
Cusp-aware (Ottosson-style) chroma reduction toward the gamut boundary happens before
contrast is computed. Pick the target gamut (P3 vs sRGB) explicitly.

### D7 — Focus-ring color is an engine token; geometry stays global

**Decided.** Amends §3.1.
Geometry (width, offset, style, `:focus-visible` policy) is global coordination. Ring
_color_ is contrast-solved per island surface and emitted by the engine. Audit the
global reset for other smuggled "looks" (`::selection`, `accent-color`, default link
color) and move them to the scoped tier.

### D8 — Semantic colors are seeded independently, not brand-derived

**Decided (build deferred).** Amends §3.2, tier 1 of D1.
success/error/warning/info are fixed signal colors, not rotations of the brand hue.
Reserve the slot in the global tier now (one sentence in the plan); build them when
the first status-bearing UI lands (likely the log-explorer migration, Phase 4).

### D9 — `brandColor` gets a three-layer defense

**Decided.** Amends §3.2, §6, §7.
(1) Defensive engine: parse/clamp/gamut-validate, return a fallback palette, **never
throw**. (2) Author-time Sanity `validation` using the engine's own color pipeline.
(3) `unstable_catchError` (`next/error`) wrapping `ProjectScope` as the backstop —
**not** a segment `error.tsx` (it doesn't catch its own layout's throw). Same
treatment for `siteSettings` brand and `cardSwatches`.

### D10 — Reference-by-key drift: typed resolvers + fallbacks now, CI check later

**Decided.** Amends §4.2, §6, Phase 2/4.
Blocking before Phase 2 locks: `keys.ts` is the single source of truth; resolvers
typed `satisfies Record<Key,…>` (missing entry = compile error); resolvers return a
typed `NotFound`, never a bare lookup; render seams show visible fallbacks
(`not-found.tsx` for a `componentKey`/slug miss; "missing embed" placeholder for an
`embedKey` miss). Deferrable to Phase 4: a CI check GROQ-ing all published keys and
asserting each exists in code; key renames as `sanity migration` scripts.

### D11 — Fonts: `preload:false` default; preload is a component-level / static-analyzability question, NOT route-level SSG

**Decided** (user call, 2026-06-21; verified against installed Next 16 docs). Amends
§5, §6, §7.
The original "is `/work/<slug>` SSG or dynamic" frame is **obsolete under Next 16
`cacheComponents`**. Static vs dynamic is no longer a route-level toggle
(`export const dynamic` / `force-static` are removed; all routes are dynamic-by-default
with PPR baked in) — it's a **component-level** concern decided by where `use cache`
sits and where request-time APIs are touched (`cacheComponents.md`,
`migrating-to-cache-components.md`). A route is a **prerendered shell with dynamic
holes**. Two independent axes follow, which must not be conflated:

- **Axis A — WHERE the preload link / theme `<style>` lands** (initial shell vs streamed
  hole): controlled by placement. Render **`ProjectScope` inside the prerendered shell**
  — `use cache` it (keyed on `brandColor`/`fontKey`, `cacheLife('max')`, no request-time
  APIs in that boundary) — so the scoped theme `<style>` and the resolved font's
  `.variable` class are in the **initial static HTML** (flash-free, no streamed delay).
  Recoverable. `generateStaticParams` is **not** the switch — the prerender step extracts
  the shell automatically; `generateStaticParams` only enumerates which slugs to
  prerender at build.
- **Axis B — WHETHER the _right_ face is preloaded at all** (targeting): **not** fixed by
  cache placement. `next/font` preload injection is a build-time static transform keyed to
  a _statically referenced_ font object; `roster[fontKey].variable` is a **runtime index**
  it can't target. Caching bakes the resolved className into the HTML but does not emit a
  targeted `<link rel=preload as=font>` for a face it couldn't statically identify.

**Baseline (unchanged):** `preload:false` on all roster faces; `preload:true` only on the
1–2 shell faces in the root layout; resolved per-project face applied via `.variable` on
the scope; `--logx-font` maps to it. If a specific above-the-fold project face must
preload, emit the `<link rel="preload" as="font" crossorigin>` manually. Verify with the
empirical `<head>` check (`pnpm build` → count `<link rel="preload" as="font">` on
`/work/<slug>`).

**Tied decision — enable `cacheComponents` app-wide (Phase 0).** This is the rendering
model the project wants anyway (prerendered shell + streamed essay/notes) and it makes
the whole static/dynamic story component-level. It is an app-wide change (dynamic-by-
default; request APIs need Suspense or arg-passing; `<Activity>`-based state preservation
across nav), so it's a deliberate Phase-0 decision, not a per-surface sprinkle. This
supersedes the casual reading of §7's `use cache` note (see FrameworkFit ⑤).

### D12 — Every CSS Module declares its `@layer` (lint-enforced)

**Decided** (verified against `node_modules/next/dist/docs/.../11-css.md`). Amends
§3.1.
Next does not auto-layer CSS Modules; an unlayered module silently outranks every
`@layer project` style. Lint-enforce that each CSS Module wraps its body in the
appropriate `@layer` (or stays strictly var-consuming). Declare `@layer foundation,
brand, project;` in a global sheet loaded first; the engine's scoped `<style>`
declares `@layer brand`.

### D13 — Streamed `<style>` uses `precedence` + slug `href` only when suspended

**Decided.** Amends §3.2, §7.
If `ProjectScope` renders in the initial shell above any Suspense (the common case),
plain inline `<style dangerouslySetInnerHTML>` is already flush-before-paint — fine.
Use React 19 `<style href={`theme-${slug}`} precedence>` only if ProjectScope can be
suspended/deferred. The walking skeleton (D17) verifies this on the real stack, since
it's React-version-dependent and not confirmable from the installed Next docs.

### D14 — Isomorphic engine enforced by lint boundary + dual-env test

**Decided.** Amends §3.2, Phase 0/1.
ESLint import boundary on `src/lib/oklch/` forbidding `next/*`, `react`, `react-dom`,
and DOM/Node globals. Dual-environment Vitest run (suite under `environment: 'node'`
AND `'jsdom'`). **Do not** use `server-only`/`client-only` — those pin the module to
one side and break the isomorphic requirement.

### D15 — Embed schema: generic `liveEmbed` default; typed block only for editorial content

**Decided.** Amends §6.
Use generic `liveEmbed` (`embedKey` + caption) when the only authored inputs are key

- caption (the majority — zero schema change to add a widget). Give a widget its own
  typed Portable Text block only when an editor must author structured _content_ (text,
  a picked image, a curated list). Never model code-level config (variants, initial
  state) as a block or a props blob — default it in the registry, or split into two
  registered keys. Litmus: _editor writes/curates it → typed block; developer decides
  it → registry; neither → not an input._

### D16 — Sanity visual-editing details

**Decided.** Amends §6, §7.
Disable stega on `brandColor`/`fontKey` (invisible encoding chars break the OKLCH
parse and font lookup). `liveEmbed` click-to-edit targets the caption/`embedKey`
field, not the interactive region. Model inter-note backlinks as real Sanity
`reference` fields (not slug strings) so `references()` resolves and integrity is
datastore-enforced. Test the experience-surface reset inside the Presentation iframe
early.

### D17 — Sequence by risk-retirement: add Phase 0.5; dead-simple project is the first slice, oklch-engine second

**Decided.** Amends `build-phases.md` throughout. (Final converged sequence per
Sequencing's closing artifact, reconciling its earlier mischaracterization with what
Architect actually conceded.)

- **Phase 0** gains all enforce-from-start guardrails: CI gate (lint/format/typecheck/
  test/build on PRs), boundary lints, the `@layer`-declaration lint (D12), a stubbed
  key-drift check (D10), and the isomorphism lint boundary (D14).
- **Phase 0.5 (NEW) — walking skeleton:** stub `ProjectScope` (hardcoded palette, no
  engine) + one hardcoded module through a thin `/work/<slug>` route. Targets the two
  version-dependent unknowns (D13 + D12) and the no-throw path (D9). Exit: verified
  precedence/flush + correct layered cascade on the real stack; `<head>` font-preload
  behavior inspected; ProjectScope provably never throws on bad input.
- **Phase 1 — engine + real ProjectScope:** decide D5/D4/D6/D8 up front; swap stub
  palette → engine (stays defensive, never throws); co-located unit + isomorphism +
  contrast tests; **visual harness over 3–4 hue-spanning colors as the exit criterion**
  (not determinism alone).
- **Phase 2 — content model + resolvers:** honest parallel gates (schema/`keys.ts`
  concurrent; `cardSwatches`/resolvers gated on Phase 1 — mark them); key-drift check
  goes live; **+ a log-explorer fit-spike** mapping its real surface onto the module +
  content model; co-located resolver/cardSwatches/index-query tests.
- **Phase 3 — first real slice = a dead-simple project** (a trivial real portfolio
  entry: static essay, one brand color, one tiny embed) — proves the vertical machinery
  against real data with nothing hard riding on it: module skeleton → routing → shell
  island → home/about/`now` (separate commits) → RSS → draft mode → `generateMetadata`.
  `not-found.tsx` via `notFound()` for an unresolved slug; the ProjectScope/layout throw
  is contained by the defensive engine + `unstable_catchError` (D9), not by
  `error.tsx`. One integration/E2E test.
- **Phase 4 — widen & harden:** **oklch-engine as the second slice** (the
  self-validating showcase, and the first "a second project ships without touching the
  first" proof); full log-explorer migration (now low-surprise, mapped by the Ph2
  spike); CWV/perf pass becomes verification; accrete shared tiers only on genuine
  second use.
  **Disposable throwaway-first project: rejected** — the stub skeleton (0.5) does the
  pre-engine isolation job more cheaply, and the Phase-3 first slice is a _real_ (if
  trivial) project, not a disposable one. **Engine-first: kept** (it IS the root risk —
  retire early), but with an observable-output exit criterion. **oklch-engine-first
  (original plan): rejected** — moved to second slice so the machinery is proven on a
  project that can isolate failures the engine showcase cannot.

### D18 — Testing is co-located with its subject in every phase

**Decided.** Amends `build-phases.md` (was unscheduled).
Vitest + RTL are already in the repo (commit `3401f2d`). Engine unit + isomorphism +
contrast tests in Phase 1; resolver/cardSwatches/index-query tests in Phase 2; one
integration/E2E of the primary flow in Phase 3. One test file ≈ one commit.

### D19 — Cross-cutting concerns get scheduled where they belong

**Decided.** Amends `build-phases.md` (was unscheduled).
CI in Phase 0; `error.tsx`/`not-found.tsx`/`loading.tsx` and `generateMetadata` (SEO/OG)
in Phase 3 where routing appears; accessibility/contrast assertions folded into Phase
1's engine harness.

### D20 — `core/` and shared primitives emerge on genuine second use

**Decided.** Amends §4.1, §4.3.
Don't pre-carve a headless `core/` into every module template — let it emerge when an
experience's logic warrants extraction, the same deferral discipline applied to the
project-local embed tier and shared primitives. Clarify §4.1's `experience.tsx` vs
`pages/` ambiguity: `experience.tsx` is the component, a thin page mounts it.

### D21 — RSC code-splitting framing corrected

**Decided.** Amends §4.2.
Server Components are auto-split already; the manual lazy `import()` buys conditional
inclusion, and the real client-bundle savings come from Client Components inside each
module (`next/dynamic`/`React.lazy`). Registry values must be **literal**
`() => import("@/projects/<slug>")` per key — a templated dynamic import defeats
bundler static analysis.

### D22 — Breakpoints are not `:root` custom properties

**Decided.** Amends §3.1.
CSS variables are invalid inside `@media` conditions. Use container queries /
build-time constants for breakpoints; custom props can still feed JS.

### D23 — Sanity Studio is standalone (a workspace package), not embedded

**Decided** (2026-06-21; verified against the official Sanity agent-toolkit, not
model memory). Amends §6, §7, Phase 0.
The Studio is a **standalone Vite app in `studio/`** — a pnpm workspace package —
not embedded in the Next app at a `/studio` route. Rationale (official guidance):
Vite dev/build is 10–30× faster than compiling the Studio through Next; standalone
Studios **auto-update** without a dependency bump or redeploy; TypeGen runs in
**watch mode** under `sanity dev`. The Next app keeps `next-sanity` for
fetching / Live Content / Visual Editing only. TypeGen is configured in
`studio/sanity.cli.ts` to emit `sanity.types.ts` into the app; CI regenerates it
and `git diff --exit-code`s the result.
**Supersedes** the "one app, no workspace" framing in §7 — the repo is now a
two-package pnpm workspace (the Next app at root + `studio/`).
**Implication for D10 / §4.2 (resolve in Phase 2):** the "Studio imports
`keys.ts`" contract now crosses a package boundary — the standalone Studio cannot
import the app's `src/*`. Put `keys.ts` in a shared workspace package both consume,
rather than duplicating it.

---

## Open items summary

None. D5 (dark mode in scope from v1) and D11 (Cache Components, component-level
static/dynamic) were resolved by the user on 2026-06-21. The only remaining
verification is the empirical font-preload `<head>` check (D11), which is a build-time
inspection during Phase 0.5, not a decision.
