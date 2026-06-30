# Decisions Log

ADR-style record of binding decisions. Each entry: the decision, the status, and why. Status
legend: **Decided** (in force) · **Superseded by D#** (replaced) · **Open** (needs the owner's
call). Records are **mutable** — edited in place, with git as the audit trail `[D33]`. The process
for opening or editing an entry is in [`handbook/decision-records.md`](handbook/decision-records.md);
the full format and copy-paste template live there.

---

### D1 — Token model: foundation → semantic → brand (three layers)

**Decided.**
Three layers — the standard scoped-semantic-theming model (Radix Themes, shadcn/ui, Material 3,
Spectrum):

- **Foundation (primitives)** — raw, context-free values at global `:root`: the editorial palette,
  the full spacing / type-scale / radius / motion scales, z-index, the reset. No meaning yet.
- **Semantic (the contract)** — generic role tokens components read (e.g. `--surface`, `--text`,
  `--primary`, `--font-body`, `--space-block`, `--radius-card`, `--motion-fast`), mapped from
  primitives. The site's **editorial look is the global default mapping** of these at `:root`.
- **Brand (per-project theme)** — a project's slot (`[data-project="<slug>"]`) **re-defines the
  semantic tokens** with its own values. It can override the **entire** semantic layer — color,
  font, spacing, type-scale, motion, radius, border, shadow, density — so the slot's components are
  completely re-skinned while the page chrome around it stays editorial `[D30]`.

There is **no separate "feel/geometry" tier**: radius/border/shadow/density are just more semantic
tokens a slot may override. **Brand is a full scoped override of the semantic layer, not a fixed
subset of categories.**

**Why:** components code against semantic names, so they are project-agnostic and fully reusable —
the same component renders under the editorial theme or any project's. A slot re-skins purely by
overriding those names in its scope; the page's editorial defaults are untouched.

### D2 — Public contract is the semantic layer; no project-prefixed token names

**Decided.**
Every component — shared and project — reads the **generic semantic** token names (e.g. `--surface`,
`--text`, `--space-*`, `--radius-*`, `--font-*`). There are **no project-prefixed token names**: the
**scope** (`[data-project="<slug>"]`) provides isolation, so two projects reuse the same names and
the cascade resolves to the nearest scope — how Radix / shadcn / Material / Spectrum isolate themes.
A project's engine-generated ramp (from its `brandColor` seed) lives as **slot-scoped primitives with
generic names** (`--ramp-1…12`), with the semantic tokens mapped to them inside the scope. A shared
unit depends only on semantic names, never a project's internals.

### D3 — Bake `oklch()` literals server-side (resolve the trilemma)

**Decided.**
The engine emits contrast-solved, gamut-mapped literal values server-side.
Relative-color CSS (`oklch(from …)`) is permitted only for decorative, non-contrast
deltas. Live per-token CSS override is explicitly **not** a goal — no consumer needs
it. Keep `var(--public, var(--_internal-default))` for downward primitive theming
only; drop the "generalizes to the whole system / live re-derivation" claim.

### D4 — Contrast is solved, not stepped

**Decided.**
The engine takes a contrast target (APCA Lc for text, WCAG 2.x as compliance
fallback) and binary-searches L for on-brand/on-surface pairs against the relevant
background, evaluated on the **gamut-mapped** color. Fixed lightness offsets are not
acceptable — equal ΔL ≠ equal contrast across hues.

### D5 — Dark mode is in scope from v1; engine signature is `(brandColor, scheme) → tokenSet`

**Decided** (user call, 2026-06-21).
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

**Seed-lightness auto-direction.** A single seed represents one mode. The engine detects when a seed
is too light to serve as the light-mode primary (it would fail the contrast floor as a primary on a
light surface) and assigns it as the **dark-mode brand**, deriving the light-mode brand from it (the
prototype's `buildDir: 'light' | 'dark'`). The exact lightness threshold is an implementation detail
for the OKLCH build slice; the never-throw fallback `[D9]` applies.

### D6 — Gamut-map before contrast math

**Decided.**
Cusp-aware (Ottosson-style) chroma reduction toward the gamut boundary happens before
contrast is computed. Pick the target gamut (P3 vs sRGB) explicitly.

### D7 — Focus-ring color is an engine token; geometry stays global

**Decided.**
Geometry (width, offset, style, `:focus-visible` policy) is global coordination. Ring
_color_ is contrast-solved per slot surface and emitted by the engine. Audit the
global reset for other smuggled "looks" (`::selection`, `accent-color`, default link
color) and move them to the scoped tier.

### D8 — Semantic colors are seeded independently, not brand-derived

**Superseded by [D32].** Body removed; the original rationale lives in git history `[D33]`. D32
(status colors are brand-derived per slot) is what holds.

### D9 — `brandColor` gets a three-layer defense

**Decided.**
(1) Defensive engine: parse/clamp/gamut-validate, return a fallback palette, **never
throw**. (2) Author-time Sanity `validation` using the engine's own color pipeline.
(3) `unstable_catchError` (`next/error`) wrapping `ProjectScope` as the backstop —
**not** a segment `error.tsx` (it doesn't catch its own layout's throw). Same
treatment for `siteSettings` brand and `cardSwatches`.

### D10 — Reference-by-key drift: typed resolvers + fallbacks now, CI check later

**Decided.**
Blocking before Phase 2 locks: `keys.ts` is the single source of truth; resolvers
typed `satisfies Record<Key,…>` (missing entry = compile error); resolvers return a
typed `NotFound`, never a bare lookup; render seams show visible fallbacks
(`not-found.tsx` for a `componentKey`/slug miss; "missing embed" placeholder for an
`embedKey` miss). Deferrable to Phase 4: a CI check GROQ-ing all published keys and
asserting each exists in code; key renames as `sanity migration` scripts.

### D11 — Fonts: `preload:false` default; preload is a component-level / static-analyzability question, NOT route-level SSG

**Decided** (user call, 2026-06-21; verified against installed Next 16 docs).
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
1–2 editorial faces in the root layout; resolved per-project face applied via `.variable` on
the slot scope, which the semantic font token reads. If a specific above-the-fold project face must
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

**Decided** (verified against `node_modules/next/dist/docs/.../11-css.md`).
Next does not auto-layer CSS Modules; an unlayered module silently outranks every
`@layer project` style. Lint-enforce that each CSS Module wraps its body in the
appropriate `@layer` (or stays strictly var-consuming). Declare `@layer foundation,
brand, project;` in a global sheet loaded first; the engine's scoped `<style>`
declares `@layer brand`.

### D13 — Streamed `<style>` uses `precedence` + slug `href` only when suspended

**Decided.**
If `ProjectScope` renders in the initial shell above any Suspense (the common case),
plain inline `<style dangerouslySetInnerHTML>` is already flush-before-paint — fine.
Use React 19 `<style href={`theme-${slug}`} precedence>` only if ProjectScope can be
suspended/deferred. The walking skeleton (D17) verifies this on the real stack, since
it's React-version-dependent and not confirmable from the installed Next docs.

### D14 — Isomorphic engine enforced by lint boundary + dual-env test

**Decided.**
ESLint import boundary on `packages/oklch/` forbidding `next/*`, `react`, `react-dom`,
and DOM/Node globals. Dual-environment Vitest run (suite under `environment: 'node'`
AND `'jsdom'`). **Do not** use `server-only`/`client-only` — those pin the module to
one side and break the isomorphic requirement.

### D15 — Embed schema: generic `liveEmbed` default; typed block only for editorial content

**Decided.**
Use generic `liveEmbed` (`embedKey` + caption) when the only authored inputs are key

- caption (the majority — zero schema change to add a widget). Give a widget its own
  typed Portable Text block only when an editor must author structured _content_ (text,
  a picked image, a curated list). Never model code-level config (variants, initial
  state) as a block or a props blob — default it in the registry, or split into two
  registered keys. Litmus: _editor writes/curates it → typed block; developer decides
  it → registry; neither → not an input._

### D16 — Sanity visual-editing details

**Decided.**
Disable stega on `brandColor`/`fontKey` (invisible encoding chars break the OKLCH
parse and font lookup). `liveEmbed` click-to-edit targets the caption/`embedKey`
field, not the interactive region. Model inter-note backlinks as real Sanity
`reference` fields (not slug strings) so `references()` resolves and integrity is
datastore-enforced. Test the experience-surface reset inside the Presentation iframe
early.

### D17 — Sequence by risk-retirement: add Phase 0.5; dead-simple project is the first slice, oklch-engine second

**Decided.** (Final converged sequence per
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
  chrome → home/about/`now` → RSS → draft mode → `generateMetadata`.
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

**Decided.**
Vitest + RTL are already in the repo (commit `3401f2d`). Engine unit + isomorphism +
contrast tests in Phase 1; resolver/cardSwatches/index-query tests in Phase 2; one
integration/E2E of the primary flow in Phase 3. One test file ≈ one commit.

### D19 — Cross-cutting concerns get scheduled where they belong

**Decided.**
CI in Phase 0; `error.tsx`/`not-found.tsx`/`loading.tsx` and `generateMetadata` (SEO/OG)
in Phase 3 where routing appears; accessibility/contrast assertions folded into Phase
1's engine harness.

### D20 — `core/` and shared primitives emerge on genuine second use

**Decided.**
Don't pre-carve a headless `core/` into every module template — let it emerge when an
experience's logic warrants extraction, the same deferral discipline applied to the
project-local embed tier and shared primitives. Clarify §4.1's `experience.tsx` vs
`pages/` ambiguity: `experience.tsx` is the component, a thin page mounts it.

### D21 — RSC code-splitting framing corrected

**Decided.**
Server Components are auto-split already; the manual lazy `import()` buys conditional
inclusion, and the real client-bundle savings come from Client Components inside each
module (`next/dynamic`/`React.lazy`). Registry values must be **literal**
`() => import("@/projects/<slug>")` per key — a templated dynamic import defeats
bundler static analysis.

### D22 — Breakpoints are not `:root` custom properties

**Decided.**
CSS variables are invalid inside `@media` conditions. Use container queries /
build-time constants for breakpoints; custom props can still feed JS. A slot needing
different responsive behavior uses **container queries scoped to the slot**.

### D23 — Sanity Studio is standalone (a workspace package), not embedded

**Decided** (2026-06-21; verified against the official Sanity agent-toolkit, not
model memory).
The Studio is a **standalone Vite app in `studio/`** — a pnpm workspace package —
not embedded in the Next app at a `/studio` route. Rationale (official guidance):
Vite dev/build is 10–30× faster than compiling the Studio through Next; standalone
Studios **auto-update** without a dependency bump or redeploy; TypeGen runs in
**watch mode** under `sanity dev`. The Next app keeps `next-sanity` for
fetching / Live Content / Visual Editing only. TypeGen is configured in
`studio/sanity.cli.ts` to emit `sanity.types.ts` into the app; CI regenerates it
and `git diff --exit-code`s the result.
**Supersedes** the "one app, no workspace" framing in §7 — the repo is now a
pnpm workspace (the Next app at root + the `studio/` and `packages/oklch` packages).
**Implication for D10 / §4.2 (resolve in Phase 2):** the "Studio imports
`keys.ts`" contract now crosses a package boundary — the standalone Studio cannot
import the app's `src/*`. Put `keys.ts` in a shared workspace package both consume,
rather than duplicating it.

### D24 — Establish the pattern early, instantiate it late (the deferral discipline)

**Decided** (user call, 2026-06-22). Generalizes [D20].
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
[`handbook/engineering-standards.md`](handbook/engineering-standards.md) §6 (the rule + its
trigger, per concern).

### D25 — Rendered surfaces get an agent-driven browser check (Chrome DevTools MCP) before done

**Decided** (user call, 2026-06-22). Complements [D17],
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
[`handbook/accessibility-and-performance.md`](handbook/accessibility-and-performance.md) §5
(what to check) and gated per task in
[`handbook/definition-of-done.md`](handbook/definition-of-done.md) §6 / §7.

### D26 — Every session gets an independent, adversarial QA pass before the PR (solo or team)

**Decided** (user call, 2026-06-25). Complements [D25].
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
  [`sessions/README.md`](sessions/README.md).

Operationalized in
[`handbook/working-with-agents.md`](handbook/working-with-agents.md) §6 (the dev↔QA loop), recorded
in each [`sessions/`](sessions/) session record's **QA log**, gated per task in
[`handbook/definition-of-done.md`](handbook/definition-of-done.md) §6 / §7, and wired into the
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
finding lives in [`sessions/2026-06-26-shell-sourcing-islands/spike-findings.md`](sessions/2026-06-26-shell-sourcing-islands/spike-findings.md);
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

### D30 — Editorial chrome is global; brand theming is slot-scoped

**Decided** (owner call, 2026-06-30). Relates to [D1], [D5], [D11], [D32].

The whole site uses one editorial system — **Newsreader + a black/white/gray neutral ramp** — declared at the global foundation tier `[D1]` and applied to every page's chrome: nav, headers, prose, backgrounds. A project's brand color + font are **slot-scoped**: they theme the project's **bounded component slot** (the interactive artifact / `<Experience />`) and nothing around it.

**Why.** This is how brand and design-system sites are built — chrome typography and structural color stay fixed and on-brand; only embedded, coded artifacts carry their own treatment. It keeps the editorial calm, makes the accessibility story trivial (chrome is neutral-on-neutral), and matches the content model: an editor cannot restyle prose — the slot's font/color belong to the project's **coded module**, not a content field.

**The slot theme contract.** `ProjectScope` (the `[data-project]` seam) emits the project's **full role palette from one seed** — brand + neutral + `success`/`warning`/`danger` + accents, scheme-aware and contrast-solved `[D5][D32]` — scoped to the slot. A full, compliant token set per slot is the point of the OKLCH engine: one seed in, an entire themeable slot out.

**The shell.** The shell chrome reads the global editorial tier. `siteSettings` holds title/description and may seed a _slot_ on the homepage; it does not drive the chrome with a brand color. The flash-free mechanics (`<Suspense>`, the `<style href>` de-dup) `[D11]` apply wherever a themed slot must paint in the initial bytes.

**Chrome accents.** A project's brand color may appear as a **decorative** accent in chrome (its index-card SVG mark, a hairline, a link on its own page) — never load-bearing for legibility. Body text and meaningful contrast stay on the neutral ramp.

**Build status (2026-06-30):** page-level scoping is the current code in `layout.tsx` and `work/[slug]/page.tsx`; the theming-inversion slice moves brand scoping down to the slot.

---

### D31 — Content read path uses next-sanity `defineLive`; the publish→revalidate webhook is the freshness source

**Decided** (2026-06-26, PR #31). Relates to [D11], [D16]; supersedes the hand-rolled `getClient`/`sanityFetch` draft branch.

Phase 3 shipped a hand-rolled `sanityFetch` (`use cache` + `draftMode()`-inside-cache → `getClient`). To get real-time draft preview (`<SanityLive>`) we migrated to next-sanity v13's `defineLive`.

**Decision:** the single content read path is **`defineLive`** (`src/sanity/lib/live.ts`), resolved from `next-sanity/live`, `strict: true`, with `serverToken` = `SANITY_API_READ_TOKEN` and a dedicated minimum-scope **Viewer** `browserToken` = `SANITY_API_BROWSER_TOKEN` (browser-exposed via the SanityLive EventSource, so never the read token). `getClient`/`draftClient` are removed. **Tag contract:** every fetch carries `sanity` + `sanity:<_type>`; `sanityFetch.ts` carries an `import "server-only"` guard. Stega field-exclusions `[D16]` are single-sourced in `src/sanity/lib/stega.ts`.

The time-based `cacheProfile` ("hours" for notes) is **dropped**: `defineLive` owns cache lifetime (1y) and freshness is **on-demand via tag revalidation**. Consequence: the **publish→revalidate webhook** (`/api/revalidate`, signed, `revalidateTag(tag, { expire: 0 })`) is now **load-bearing for published cold-cache freshness** — without it (and without a connected `<SanityLive>` EventSource) a cold visitor could be served up-to-1y-stale initial HTML. Acceptable for a personal garden **given the webhook is verified in prod**. [D30] frames the read-path: the shell reads its `siteSettings` content on the normal draft path (not the live browser path), so `<SanityLive>`/`defineLive` only ever handle _content_ — the shell never needs the live path.

**Boundaries:** the webhook registration in Sanity + the hosted Studio deploy are owner-ops, tracked in the [GitHub issue backlog](https://github.com/jamierthompson/digital-garden/issues). The shell `siteSettings` read stays on the normal draft path, not the live browser path.

---

### D32 — Status colors are brand-derived per slot (supersedes D8)

**Decided (build deferred)** (owner call, 2026-06-27). Supersedes D8.

D8 ruled that `success`/`error`/`warning`/`info` are **fixed signal colors, seeded
independently of the brand** — reserved as global `:root` slots. The owner reverses that: **every
project slot gets its own status colors, derived from its brand hue by the OKLCH engine** —
scheme-aware and contrast-solved like the rest of the ramp, delivered through the slot's
`ProjectScope` rather than as one fixed global set.

**Why.** Each project's interactive slot is its own strongly-branded scope; a single global signal
palette would read as foreign inside it. Deriving status colors from the brand hue keeps them
harmonized while the contrast solve (`[D4]`, gamut-mapped first `[D6]`, never-throw fallback `[D9]`)
keeps them legible in both schemes `[D5]`.

**Consequences.** The engine grows status-token outputs (more solve work per scope, memoizable
the same way as the rest). The fixed global status-color slot from D8 is **not** built; status colors are
per-slot semantic tokens, not a new global tier (consistent with `[D1]`). **Build is still deferred** until
the first status-bearing UI lands — the _approach_ changed, not the trigger. Open design detail
for the implementing PR: how far each status hue may rotate toward the brand while staying a
recognizable signal. Tracked in the
[GitHub issue backlog](https://github.com/jamierthompson/digital-garden/issues).

Status-from-brand resolves **inside the project slot**: the "a global signal palette reads as foreign
inside a strongly-branded scope" rationale applies to the slot, since page chrome is global editorial
`[D30]`.

### D33 — Decision records are mutable; git is the audit trail (retires the supersede-only norm)

**Decided** (owner call, 2026-06-27); see
[`handbook/decision-records.md`](handbook/decision-records.md).

Earlier practice treated every accepted decision as **immutable**: when the thinking changed you
appended a _superseding_ `D#` and never edited the original (classic ADR discipline — Nygard/Fowler).
The owner retires that norm. **Decision records are now edited in place**, and **git history is the
audit trail** — `git log -p docs/decisions.md` recovers any prior wording with author and
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

### D34 — One content type (`project`); scope and maturity are independent axes

**Decided** (owner call, 2026-06-30). Applies the `[D24]` deferral discipline.

The site has **one document type — `project`**. A note and a project share this same type; the
difference is **scope, not schema** — a note is shorter and single-topic. Interconnected notes
sometimes grow into a new project while the notes themselves remain, which is why backlinks are
Day-1 `[D35]`. Fields a large piece needs (essay, component, moodboard) are **optional**, not a
parallel schema.

**Maturity field.** Every piece carries a maturity indicator with three stages, surfaced as
**sketch → prototype → shipped** (rough → working → stable; "sketch" covers a one-image visual note).
The field stores **stable values**; the labels are display titles, **re-wordable anytime with zero
migration**. Maturity is the honesty badge + permission-to-publish-rough, and is **orthogonal to both
curation** (the front-door `featuredRank`) **and scope** — a note moves through the stages and stays a
note.

**Naming.** The schema `_type` stays `project`; the **display label is decoupled** from it (UI text
is free; the `_type` is the migration-costed thing). A second content type is **deferred** until a
_shipped_ piece proves the fields genuinely diverge `[D24]` — "I'll need it later" is not the trigger.

### D35 — Backlinks are Day-1, not deferred

**Decided** (owner call, 2026-06-30). Relates to [D10], [D16], [D34].

The association graph ships **with the first schema pass**. A `project` carries a **`related`**
reference array targeting other `project` docs (self-referencing, since there is one type `[D34]`),
and the read path resolves **incoming** backlinks via GROQ **`references()`** — so an edge authored
once shows on **both** ends for free. Backlinks are the connective tissue of the portfolio spine (a
piece links the pieces it builds on, and those edges trace the thesis), so they are **load-bearing
Day-1 functionality**, on the build list rather than the `[D24]` deferral list.

### D36 — Flat routes: `/[slug]`, no `/work` prefix

**Decided** (owner call, 2026-06-30).

A project lives at a **flat, root-level slug** (`/oklch-playground`), with no `/work` prefix. The
route is a single root-level dynamic segment that **cedes precedence to static segments** (`/about`,
`/now`, …) — fine in Next (static segments beat the dynamic segment), with a deliberate **not-found
story** for unknown slugs designed when the segment lands. Rationale: more garden-coherent, more
shareable, and it treats each project as a first-class destination — consistent with the
self-themed-slot architecture `[D30]`.

**Build status (2026-06-30):** the route is `app/work/[slug]/`; the route-flattening slice moves it
to a root-level segment.

---

## Open items summary

None. D5 (dark mode in scope from v1) and D11 (Cache Components, component-level
static/dynamic) were resolved by the user on 2026-06-21.
