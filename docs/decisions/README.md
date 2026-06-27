# Decisions Log

ADR-style record of binding decisions. Each entry: the decision, the status, why, and which
system-model section (`§N`) it amends. Status legend: **Decided** (in force) · **Superseded by
D#** (replaced) · **Open** (needs the owner's call). Records are **mutable** — edited in place, with
git as the audit trail `[D33]`. The process for opening or editing an entry is in
[`../handbook/decision-records.md`](../handbook/decision-records.md); the full format and copy-paste
template live there.

> `§N` references point at the system model in
> [`../handbook/architecture.md`](../handbook/architecture.md); this log is the source of truth
> where the two disagree. The original entries (D1–D23) came from the pre-build architecture audit.

---

### D1 — Token model is three tiers, not "complete self-described islands"

**Decided.** Amends §3.1, §1, §8.
Foundation (spacing, motion, breakpoints, z-index, type-scale ratios) lives at global `:root`. Brand ramp + font are engine-scoped per
`[data-project]`. Feel/geometry (radius, border weight, shadow, density) is a small
scoped override set with defaults inherited from the global tier.
**Why:** only brand, font, and feel actually vary across ~5 projects; re-declaring a
complete foundation per island is cost without benefit and bloats each `<style>`
flush. Rewrite §3.1's rule to "no global **brand/feel** values; foundation
is global."

_Updated 2026-06-27 `[D33]`: dropped semantic colors from the foundation tier — status colors are
brand-derived per island per `[D32]`._

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

**Superseded by [D32].** Body removed; the original rationale lives in git history `[D33]`. D32
(status colors are brand-derived per island) is what holds.

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

**Decided.** Amends the build plan throughout. (Final converged sequence per
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

**Decided.** Amends the build plan (was unscheduled).
Vitest + RTL are already in the repo (commit `3401f2d`). Engine unit + isomorphism +
contrast tests in Phase 1; resolver/cardSwatches/index-query tests in Phase 2; one
integration/E2E of the primary flow in Phase 3. One test file ≈ one commit.

### D19 — Cross-cutting concerns get scheduled where they belong

**Decided.** Amends the build plan (was unscheduled).
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

### D24 — Establish the pattern early, instantiate it late (the deferral discipline)

**Decided** (user call, 2026-06-22). Amends §1, §4. Generalizes [D20].
The repo's standing structural rule, lifted from a per-case habit to a first-class standard:
**name where each kind of code _will_ live, but don't stand up the structure until a concrete
trigger earns it.** [D20] applied this to `core/` and shared primitives; this generalizes it so
every "should I factor this out yet?" call is answered the same way instead of re-argued each
time. It rests directly on §1's guiding principles — "no premature abstraction" and
"right-sized, not maximal".

The pattern is named up front; instantiation waits for its trigger:

| Concern                    | Default                      | Trigger to instantiate                                                                                                   |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shared primitive / `core/` | lives in the owning module   | **genuine second use**, or an experience's logic outgrows its render — never by template ([D20])                         |
| Shared type                | in the module's own file     | the **second** module that imports it → promote to `src/types/*`                                                         |
| Client state store         | local `useState` at the leaf | you start **prop-drilling** one value through 2+ uninterested components → lift to lowest common owner / Context / store |
| Embed tier                 | one shared registry          | a **second project** reuses a widget → add the project-local tier ([D15], §4.1)                                          |

**Why / consequences.** Merge = production deploy, so premature scaffolding is unshipped
surface area that rots before it is used; deferring keeps `main` lean. Naming the destination
first is what stops deferral becoming disorder — a reader always knows where a concern _will_
go, so waiting costs nothing in legibility. **What gets harder:** spotting the trigger takes
judgment, and "I'll need this later" is explicitly _not_ a trigger — the discipline is to wait
for the _actual_ second use / the _actual_ prop-drill. Codified as a working standard in
[`handbook/engineering-standards.md`](../handbook/engineering-standards.md) §6 (the rule + its
trigger, per concern).

### D25 — Rendered surfaces get an agent-driven browser check (Chrome DevTools MCP) before done

**Decided** (user call, 2026-06-22). Amends the build plan (Phase 0.5+). Complements [D17],
[D18], [D19].
`pnpm test` runs in **jsdom** — it doesn't paint, can't render async RSCs, and measures nothing
about focus visibility, tap-target size, layout shift, or paint timing. So build-green +
unit-green is **not** evidence a surface is accessible or unbroken in a browser. Standing
requirement: when a task ships or changes a **rendered, user-facing surface** (a route, visual
output, theming / `ProjectScope`, focus/interaction), verify it in a real browser via the
`chrome-devtools` MCP before calling it done — focus & tap-size (the always-on WCAG-AA floor),
no CLS/paint regression, flash-free theme ([D11]), clean console.

**Boundaries — so this doesn't collide with the phasing:**

- It is **not** the Phase-4 CWV **budget** pass ([D17]). That formal LCP/INP/CLS-budget +
  perf-hardening gate stays Phase 4; this is the lighter per-task "did I obviously regress the
  surface I just touched."
- It is **not** a committed test and **not** a CI gate — CI can't drive a browser. Committed
  automated coverage stays Vitest now / Playwright at Phase 3 ([D18], [D19]); this is an
  agent-in-the-loop manual step, the same status as the empirical `<head>` font-preload check
  ([D11]).
- It fills the **browser-verification gap** for UI built in Phases 0.5–2, before Playwright
  lands.

Operationalized in
[`handbook/accessibility-and-performance.md`](../handbook/accessibility-and-performance.md) §5
(what to check) and gated per task in
[`handbook/definition-of-done.md`](../handbook/definition-of-done.md) §6 / §7.

### D26 — Every session gets an independent, adversarial QA pass before the PR (solo or team)

**Decided** (user call, 2026-06-25). Amends `handbook/working-with-agents.md` §6; complements [D25].
A gate-green slice is _developer-done_, not _review-done_ — `pnpm test` plus the author's own
self-check prove the author's intent, not that the work survives someone trying to break it.
Standing requirement, **independent of staffing**: before any slice enters a PR, a **fresh** agent —
never the one that wrote it, isolated context (briefed per §5) — runs **adversarial QA**. It does not
merely re-read the diff: it tries to **break** the slice, hunts the edge / error / boundary /
malformed-input cases the author didn't, and **writes the missing test cases a QA engineer on a
product team would**. One QA agent **per coding agent**: a solo session (the lead is also the sole author)
spawns one QA for its own work; a team session spawns one QA per slice author. Findings return to the
**owning** author to fix; QA re-checks; repeat until clean.

**Boundaries:**

- **Not a CI gate.** There is no automatic review bot in `verify`; this is an agent-in-the-loop step
  the lead runs **pre-PR** — the same status as the [D25] browser check. The on-demand `@claude` PR
  workflow is a tool the lead may invoke, not the gate.
- **Does not replace** the author's own gate (DoD §1) — it is the independent layer on top of it.
- **"Adversarial" means break-it-and-prove-it**, fact-grounded against the `[D#]`s and the bundled
  docs — not nit-picking style the formatter already owns.
- In-scope findings are **fixed before the PR**; only genuinely later-phase work is deferred (filed
  as a GitHub issue with a one-line reason).
- **The QA pass leaves a durable record.** Its outcome — what was tested, what passed, each defect →
  fix → re-check, and the tests QA authored — is captured in the session record's **QA log** (one entry
  per coding agent), so the green gate is never mistaken for the QA evidence. Format:
  [`sessions/README.md`](../sessions/README.md).

Operationalized in
[`handbook/working-with-agents.md`](../handbook/working-with-agents.md) §6 (the dev↔QA loop), recorded
in each [`sessions/`](../sessions/) session record's **QA log**, gated per task in
[`handbook/definition-of-done.md`](../handbook/definition-of-done.md) §6 / §7, and wired into the
`agent-team` coding mode.

---

### D27 — Cascade layers must register before `next/font`: global CSS imported first in the root layout

**Decided** (2026-06-25, after prod/browser verification). Refines [D12]; relates to [D11].

[D12] (the "@layer trap") established that `foundation.css` declares `@layer foundation, brand, project;`
so later sheets slot into a named order instead of fighting specificity. Its stated mechanism — "a
global sheet **loaded first** establishes the order" — was necessary but **under-specified**: in
Next 16 / Turbopack, sheet load order is set by **import order in the root layout**, and
`src/app/layout.tsx` imported `next/font/google` (and the component modules) **before**
`import "./foundation.css"`.

Consequence (proven, not theorized): Turbopack anchors a route's **first emitted stylesheet** to
whatever is imported first. With `next/font` ahead of `foundation.css`, the font + component-module
chunk — which carries `@layer project { … }` but never names `foundation` — loaded first, so the
browser registered **`project` as the lowest-priority layer**. The foundation reset
(`@layer foundation { * { margin:0; padding:0 } }`) then out-ranked every `@layer project` rule and
zeroed their padding/margin (tag chips, embed caption, experience module). This was **deterministic
on a fresh checkout** (3/3 clean builds) and was **live in production** (`/work/first-light` chips
computed `padding: 0`, registered order `project < foundation < brand`). It did **not** reproduce in
git **worktrees** — Turbopack's chunk emission order is environment-sensitive — a verification trap: a
worktree can mask a bug that ships from a fresh checkout. **Trust a clean `main`/CI build and the live
deploy, not a worktree.**

**Decision:** the layer-establishing global CSS (`foundation.css`, then `globals.css`) **must be
imported first in `src/app/layout.tsx`** — above the `next/font` import and every component import — so
the foundation chunk is the first emitted stylesheet and registers `foundation < brand < project` as
declared. This is a **source-order invariant**: load order = import order, which an import-sorter
(ESLint `import/order` / `simple-import-sort` / Prettier organize-imports) would silently break. None is
enabled today; a **guard test** (`src/app/layout.import-order.test.ts`) pins it — `foundation.css` must
be the first side-effect import — so a reorder or a future sorter fails the gate instead of reinverting
the cascade. `lint:css` cannot catch this (it checks per-module layer declaration, not runtime
registration order).

**Verified:** the fix produces `foundation`-first across 3 clean builds × 5 routes on the canonical
(fresh-checkout) environment, and browser-verified `padding: 4px 12px` on the chips in both color
schemes. It is a one-region import reorder — no reset surgery — restoring [D12]'s intent rather than
working around it. The rejected symptom-patch (retargeting the reset so this one collision disappears
while the layers stay inverted) was explicitly **not** taken.

**Addendum (2026-06-27) — re-tested, found non-reproducing, and deliberately RETAINED.** A 2026-06-26
spike re-ran the original repro (main tree, cold `.next`, clean production build) and found that moving
`next/font` **above** the global sheets did **not** invert the cascade in Next 16.2.9 — the `.tag` chip
kept `padding: 4px 12px` in baseline and reordered, warm and cold (browser-verified computed style). So
the import-order constraint appears to be a **red herring _now_** — either it never was load-bearing, or
Turbopack's stylesheet ordering was since fixed. **This does not reverse D27.** The original inversion was
deterministic on a fresh checkout and live in production when D27 was recorded (on an earlier Next), and
Turbopack chunk-emission order is environment-sensitive enough `[D29]` that the cheap guard (a one-region
import order + `layout.import-order.test.ts`) is worth keeping as insurance against a future regression.
**Owner's call (2026-06-27): retain the constraint; D27 stands, not superseded.** The non-reproduction
finding lives in [`sessions/2026-06-26-shell-sourcing-islands/spike-findings.md`](../sessions/2026-06-26-shell-sourcing-islands/spike-findings.md);
the retention decision is recorded in this register (D27).

---

### D28 — Adversarial QA must have no prior context of the work, not merely "not the author"

**Decided** (user call, 2026-06-25). Refines [D26].

[D26] requires the pre-PR adversarial QA to be a **fresh** agent — "never the one that wrote it." This
session (Item C, the draft-preview blocking-route fix) showed "not the author" is too weak: a fresh
agent that has nonetheless absorbed the slice's diagnosis, design debate, and fix rationale is **primed
to confirm** — it inherits the author's mental model, including the author's blind spot. Here the author
"verified" the fix by checking brand-token _presence_ in dev-server HTML and rationalized past a
ship-blocker (a React 19 `<style>` href de-dup that made the engine fallback palette win on the
production build). The QA that caught it was a **fresh agent with no prior context of the work** — it
independently chose the right method (computed/applied style on a clean production build) precisely
because it had not been told what to expect.

**Decision:** the [D26] QA agent must have **no prior context of the work under review** — it must not
have participated in, nor been briefed on, the slice's diagnosis, design, or implementation, and must
not be shown the author's verification reasoning. It is briefed only on the **requirements** and the
**artifact** (the diff), then told to break it. "Fresh / not the author" is the floor; **no prior
context** is the standard: a teammate that helped design or debate the slice is **disqualified** as its
QA even though it didn't type the code.

**Boundaries:** otherwise unchanged from [D26] — one QA per coding agent, findings to the owning author,
re-check until clean, durable QA log in the session record. D28 only strengthens _who qualifies_ as the
QA agent. Operative wording updated in `AGENTS.md`, `handbook/working-with-agents.md` §6,
`handbook/definition-of-done.md`, and `handbook/orientation.md`.

---

### D29 — Agent-team coding slices run in in-root git worktrees, not the ephemeral `isolation` flag

**Decided** (user call, 2026-06-26). Relates to [D27]; makes the `handbook/working-with-agents.md` §6.2 "lead clears the path" principle mechanical.

Parallel coding slices need real isolation — a separate checkout + branch per teammate so edits don't overwrite and builds (`.next`) don't collide. Two ways to get a worktree:

- the harness **`isolation: "worktree"`** spawn flag → the checkout lands in an **ephemeral dir outside the project root**;
- **`git worktree add .claude/worktrees/<slug>`** → a persistent checkout **inside** the root.

The flag breaks the permission model: `acceptEdits` auto-accepts edits only within the session **cwd + `permissions.additionalDirectories`**; an out-of-root path falls out of scope, so **every** Edit/Write prompts the owner (PR #20's prompt storm). Path-glob `allow` rules don't help — the mode/scope check runs **before** allow-rule matching. (Confirmed empirical-but-undocumented for the experimental agent-teams feature.)

**Decision:** team coding slices use **in-root** worktrees — `git worktree add .claude/worktrees/<slug> <branch>` — **never** the `isolation: "worktree"` spawn flag. Because `.claude/worktrees/` sits under the repo root (= the teammate's cwd), `acceptEdits` silently covers every edit there; the lead never babysits per-edit prompts. The dir is already git-excluded (`.git/info/exclude`) and Prettier/ESLint-ignored; this change adds it to tsconfig `exclude` and to `permissions.additionalDirectories` (belt-and-suspenders). The **lead owns the sharing mess**: create the worktree + branch, run `pnpm install` per worktree (worktrees don't inherit the gitignored `node_modules`), assign a **distinct dev-server port** per slice (ports are host-global — worktrees don't isolate them), and `git worktree remove` on cleanup.

**Verification caveat [D27]:** a worktree isolates _editing_ — it must **never** be trusted for _final verification_. [D27]'s trap stands: Turbopack chunk-emission order is environment-sensitive and a worktree can mask a bug that ships from a fresh checkout. Gate the curated tip on a clean `main`/CI build and the live deploy, not in a worktree.

**Boundaries:** applies to the parallel-coding mode (file-disjoint slices). Read-only modes (research / debate / review) need no worktree. Operative wording added to `.claude/skills/agent-team/SKILL.md` §1, `references/coding-feature.md`, and `handbook/working-with-agents.md` §6.1.

---

### D30 — Path A: the shell is an editorial Sanity island; the `next dev`-only unbranded flash is accepted

**Decided** (2026-06-26, after a 4-lens agent-team debate + empirical spike; reverses a mid-point "code-config" verdict — see [`sessions/2026-06-26-shell-sourcing-islands/`](../sessions/2026-06-26-shell-sourcing-islands/)). Relates to [D11], [D16].

The question circled several sessions: where does the shell's brand/identity come from, and why does the shell "flash" unthemed? A mid-point verdict was to make the shell a synchronous code constant (`shell.config.ts`). The spike refuted both its pillars: (a) the flash is **`next dev`-only** — a production build serves the PPR build-time-resolved themed shell in the initial bytes (zero unbranded frames, draft included); and (b) the shell brand is **editorial content, not a constant** — it lives in `siteSettings`, read async + draft-aware exactly like a project reads its own brand.

**Decision:** the shell is an **editorial Sanity island, symmetric with each project island**. Brand / font / title / description stay in `siteSettings`, read through the normal async draft-aware path; **no** synchronous-config refactor, **no** `shell.config.ts`, `siteSettings` is **not** dissolved. The unbranded fallback frame is a **dev-only** artifact and is **accepted** — symmetric with every project's unthemed `loading.tsx`. The `<Suspense>` boundary + **unthemed** `ShellThemeFallback` in `layout.tsx` stay load-bearing (a themed fallback collides with the real shell on `<style href>` de-dup — the Item C regression QA caught). **Verified flash-free on the live Vercel deploy** (2026-06-26, both before and after the defineLive read-path migration): branded shell in the initial PPR bytes, `x-nextjs-prerender:1`.

**Boundaries:** "theme the fallback" is **retired** (it was never the problem). Abandoned directions: the `spike/zero-flash-shell` themed-fallback branch and the synchronous-shell / `shell.config.ts` design.

---

### D31 — Content read path uses next-sanity `defineLive`; the publish→revalidate webhook is the freshness source

**Decided** (2026-06-26, PR #31). Relates to [D11], [D16]; supersedes the hand-rolled `getClient`/`sanityFetch` draft branch.

Phase 3 shipped a hand-rolled `sanityFetch` (`use cache` + `draftMode()`-inside-cache → `getClient`). To get real-time draft preview (`<SanityLive>`) we migrated to next-sanity v13's `defineLive`.

**Decision:** the single content read path is **`defineLive`** (`src/sanity/lib/live.ts`), resolved from `next-sanity/live`, `strict: true`, with `serverToken` = `SANITY_API_READ_TOKEN` and a dedicated minimum-scope **Viewer** `browserToken` = `SANITY_API_BROWSER_TOKEN` (browser-exposed via the SanityLive EventSource, so never the read token). `getClient`/`draftClient` are removed. **Tag contract:** every fetch carries `sanity` + `sanity:<_type>`; `sanityFetch.ts` carries an `import "server-only"` guard. Stega field-exclusions `[D16]` are single-sourced in `src/sanity/lib/stega.ts`.

The time-based `cacheProfile` ("hours" for notes) is **dropped**: `defineLive` owns cache lifetime (1y) and freshness is **on-demand via tag revalidation**. Consequence: the **publish→revalidate webhook** (`/api/revalidate`, signed, `revalidateTag(tag, { expire: 0 })`) is now **load-bearing for published cold-cache freshness** — without it (and without a connected `<SanityLive>` EventSource) a cold visitor could be served up-to-1y-stale initial HTML. Acceptable for a personal garden **given the webhook is verified in prod**. Path A [D30] frames the read-path: the shell is an editorial island on the normal draft path, so `<SanityLive>`/`defineLive` only ever handle _content_ — the shell never needs the live path.

**Boundaries:** the webhook registration in Sanity + the hosted Studio deploy are owner-ops, tracked in the [GitHub issue backlog](https://github.com/jamierthompson/digital-garden/issues). The shell `siteSettings` read stays on the normal draft path, not the live browser path.

---

### D32 — Status colors are brand-derived per island (supersedes D8)

**Decided (build deferred)** (owner call, 2026-06-27). Amends §3.1, §3.2. Supersedes D8.

D8 ruled that `success`/`error`/`warning`/`info` are **fixed signal colors, seeded
independently of the brand** — reserved as global `:root` slots. The owner reverses that: **every
island gets its own status colors, derived from its brand hue by the OKLCH engine** —
scheme-aware and contrast-solved like the rest of the ramp, delivered per-project through
`ProjectScope` rather than as one fixed global set.

**Why.** The garden's identity is that each project is a fully self-themed island; a single global
signal palette would read as foreign inside a strongly-branded scope. Deriving status colors from
the brand hue keeps them harmonized while the contrast solve (`[D4]`, gamut-mapped first `[D6]`,
never-throw fallback `[D9]`) keeps them legible in both schemes `[D5]`.

**Consequences.** The engine grows status-token outputs (more solve work per scope, memoizable
the same way as the rest). The global-tier "semantic-color slot" from D8/D1 is **not** built;
no new global brand/feel tier appears (consistent with `[D1]`). **Build is still deferred** until
the first status-bearing UI lands — the _approach_ changed, not the trigger. Open design detail
for the implementing PR: how far each status hue may rotate toward the brand while staying a
recognizable signal. Tracked in the
[GitHub issue backlog](https://github.com/jamierthompson/digital-garden/issues).

### D33 — Decision records are mutable; git is the audit trail (retires the supersede-only norm)

**Decided** (owner call, 2026-06-27). Amends the decision-records process
([`../handbook/decision-records.md`](../handbook/decision-records.md)).

Earlier practice treated every accepted decision as **immutable**: when the thinking changed you
appended a _superseding_ `D#` and never edited the original (classic ADR discipline — Nygard/Fowler).
The owner retires that norm. **Decision records are now edited in place**, and **git history is the
audit trail** — `git log -p docs/decisions/README.md` recovers any prior wording with author and
message. Every change already lands through the normal branch → gate → squash-merge flow, so the
trail is durable without the in-document ceremony.

**Why.** The supersede-only rule existed to preserve _why the thinking moved_ when nothing else
recorded it. Git already does — per line, with author and message — so the ceremony was duplicated
bookkeeping that grew the log (D8 sat frozen-wrong beside D32) and let stale prose linger in
"frozen" bodies. Editing in place keeps the register reading as **current truth**.

**Consequences.** Supersession becomes **optional** — kept only when leaving the old rationale
visible _inline_ genuinely helps (the `Superseded by D#` status token stays in the legend for that
case). A material edit may carry a dated `_Updated YYYY-MM-DD:_` note for inline legibility, but git
is the record. Existing superseded pairs are left as-is. This decision is the first edit under the
new norm: in the same change, D8 was tombstoned into D32 and D1's stale semantic-color line was
corrected.

---

## Open items summary

None. D5 (dark mode in scope from v1) and D11 (Cache Components, component-level
static/dynamic) were resolved by the user on 2026-06-21.
