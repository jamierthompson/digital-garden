# Portfolio & Digital Garden — Implementation Phases

Concrete build sequence derived from `architecture-plan.md`. Section references (e.g. §3.2)
point back to that plan; decision references (e.g. `[D17]`) point to `docs/decisions.md`.

> **Revised 2026-06-21** to incorporate the architecture audit (`docs/audit/`). The headline
> change: **sequence by risk-retirement, not dependency topology** `[D17]` — a Phase 0.5
> walking skeleton retires the integration + framework risks before the engine is built; the
> first real slice is a dead-simple project; `oklch-engine` moves to the second slice.

**Organizing principle:** retire the highest-uncertainty risks first. The engine's
color-science correctness and the Next-16/React-19 render unknowns are the real risks — not
the code-dependency order. Drive toward one working, flash-free themed project rendered
through `ProjectScope`, proving each risk in isolation before composing them.

**Critical spine:** guardrails (Ph0) → walking skeleton retires render unknowns (Ph0.5) →
engine retired against observable output (Ph1) → content model + log-explorer fit-spike (Ph2)
→ dead-simple first slice proves the machinery (Ph3) → oklch-engine + real migration widen on
proven ground (Ph4).

**Parallelism:** Phase 2 (Sanity schema + `keys.ts`) runs alongside Phase 1; resolvers and
`cardSwatches` are gated on their real dependencies and marked as such.

**Working style:** one task ≈ one commit, each a completed, gate-green slice its agent owns; the
lead curates history (squash/reorder) before a squash-merge, so the story is told once in the PR.
Tests are co-located with their subject in every phase (Vitest + RTL are already set up).

---

## Phase 0 — Scaffolding + guardrails

_Stand up the app, global plumbing, content backend, AND every enforce-from-start guardrail.
Guardrails are cheap when empty and rot if deferred `[D17]`._

- [√] Create the Next.js 16.2 app (App Router, Turbopack default), React 19; deploy to Vercel with full SSR/RSC (§7)
- [√] **Enable `cacheComponents` app-wide** — commit to the prerendered-shell + streaming model now; it's an app-wide rendering change, not a per-surface sprinkle (§7) `[D11]`
- [√] Lock styling baseline: CSS custom properties only — no Tailwind, no JSON tokens, no Style Dictionary (§7)
- [√] Author the **invariant tier** at `:root`: spacing ramp, motion curves, breakpoints (build constants, not `@media` vars `[D22]`), z-index scale, type-scale ratios, focus-ring **geometry**, reset, semantic-color **slots** (§3.1) `[D1, D8]`
- [√] Emit the bare `@layer foundation, brand, project;` order statement in a global sheet loaded first (§3.1) `[D12]`
- [√] **CI gate** from commit #1: lint / format / typecheck / test / build on PRs (never commit to main) `[D17, D19]`
- [√] **Boundary lints** (stood up empty): no project→project, no shared→project; plus the `src/lib/oklch/` isomorphism boundary forbidding `next/*`/`react`/DOM/Node (§3.2, §7) `[D14]`
- [√] **`@layer`-declaration lint**: every CSS Module declares its layer or stays strictly var-consuming (§3.1) `[D12]`
- [√] **Key-drift CI check** (stubbed now, live in Phase 2): keys.ts ↔ resolvers (§4.2) `[D10]`
- [√] Bootstrap Sanity as a **standalone Studio** in `studio/` (a pnpm workspace package, not embedded) `[D23]`; wire the TypeGen + `defineQuery` pipeline (configured in `studio/sanity.cli.ts`, emits `sanity.types.ts`), with a CI `git diff --exit-code` on generated types (§6, §7)
- [√] Build a bare shell layout: root layout + nav skeleton (unthemed placeholder); declare the 1–2 shell fonts `preload: true` here (§2, §5) `[D11]`

**Exit:** app deploys on Vercel; `cacheComponents` on; CI + boundary + `@layer` + key-drift
lints green (even while guarding little); invariant `:root` tier and `@layer` order in place;
Sanity reachable with TypeGen running.

---

## Phase 0.5 — Walking skeleton _(NEW — retires the render unknowns)_ `[D17]`

_A stub `ProjectScope` (hardcoded palette, NO engine) + one hardcoded module shell through a
thin `/work/<slug>` route. Does the integration-isolation job more cheaply than a throwaway
project, and proves the genuinely version-dependent unknowns before any subsystem is built._

- [√] Stub `ProjectScope`: hardcoded palette + font class, scoped `<style>`, no engine
- [√] One hardcoded module shell rendering through a thin `/work/<slug>` route on Vercel
- [√] **Prove the two version-dependent unknowns** (not flash-free-color, which is already verified): (a) React 19 `<style precedence>` + Suspense **flush-before-paint**; (b) `@layer`-vs-unlayered-CSS-Module cascade (unlayered silently wins) (§3.1, §3.2) `[D12, D13]`
- [√] **Prove the no-throw path:** stub `ProjectScope` returns a safe fallback on missing/invalid seed and **never throws**; wrap it in `unstable_catchError` (§6, §7) `[D9]`
- [√] **Empirical `<head>` check:** `pnpm build` → inspect `/work/<slug>` for `<link rel="preload" as="font">` and confirm the `preload:false` policy holds (§5) `[D11]`

_Done 2026-06-23 (PR #9, `a36c5fd`) — verdicts in [`runs/2026-06-23-phase-0.5-walking-skeleton.md`](./runs/2026-06-23-phase-0.5-walking-skeleton.md)._

**Exit:** a hardcoded project renders flash-free through the stub scope on Vercel; verified
precedence/flush + correct layered cascade on the real Next 16 / React 19 build; `ProjectScope`
provably never throws on bad input; font-preload behavior confirmed. _This is the early
integration checkpoint the original plan lacked._

---

## Phase 1 — Theming keystone _(the root risk: engine correctness)_

_Build the engine — the load-bearing, genuinely hard piece — and the real `ProjectScope`.
Decide the hard color-system questions up front; the exit criterion is observable output, not
determinism `[D17]`._

- [√] Build the OKLCH engine in `src/lib/oklch/`: pure, isomorphic, no React/DOM/Node (§3.2) `[D14]`
- [√] **Decide up front, because they shape the signature:** scheme-aware `(brandColor, scheme) → tokenSet` with `light-dark()` output (dark mode is in scope from v1) `[D5]`; contrast **solved** via APCA/WCAG binary-search on L `[D4]`; **gamut-map** before contrast math `[D6]`; semantic-color seeding is independent, not brand-derived `[D8]`; focus-ring **color** is an engine token `[D7]`
- [√] Engine **bakes literal `oklch()` values** server-side and is **defensive** — returns a fallback palette, never throws (§3.2) `[D3, D9]`
- [√] Shape engine exports: low-level surface (ramp, chroma/lightness steps, contrast values) **and** a high-level `(brandColor, scheme) → tokenSet` wrapper (§3.2)
- [√] Build the real `ProjectScope` (server component): swap the stub palette → engine output; map brand tokens into the namespace; apply the resolved font's `.variable` class; render flash-free in the prerendered shell as a **synchronous** server component (a sync component's output is auto-included in the static HTML shell — no `use cache` needed, confirmed against the bundled caching docs; `use cache` would force it async and break jsdom testability); keep the `unstable_catchError` backstop (§3.1, §3.2, §6, §7) `[D9, D11]` — _done 2026-06-24 (PR #14)_
- [√] Build the font roster `src/fonts/roster.ts`: `preload: false` on all faces; variable fonts; `font-display: swap`; subset (§5) `[D11]`
- [√] Author `keys.ts` string-constant contracts for `componentKey`/`fontKey`/`embedKey` (§6) `[D10]`
- [√] **Co-located tests:** engine unit + **dual-env isomorphism** (node + jsdom) + **contrast assertions in both schemes** `[D14, D4, D5]`
- [√] **Visual harness** — render ramps for 3–4 representative brand colors spanning the hue wheel (include a yellow and a cyan, the contrast-stressers), light and dark, asserting APCA Lc / WCAG ratios on every text-on-surface and on-brand pair _after_ gamut-mapping `[D4, D17]`

_Engine + roster + `keys.ts` + tests + harness done 2026-06-23 (PRs #8 `c681a44`, #10 `49f1071`). The real `ProjectScope` done 2026-06-24 (PR #14) — **Phase 1 complete**._

**Exit:** the engine returns a contrast-valid token set (both schemes) from a brand color and
runs identically server/client; the visual harness **proves palette quality**, not just
determinism; `ProjectScope` renders flash-free for a real `brandColor`/`fontKey` **and degrades
safely** on bad input; tests green.

---

## Phase 2 — Content model + reference-by-key wiring _(parallel with Phase 1, honest gates)_

_Model content in Sanity and wire the key→code resolvers, keeping implementations out of the
Studio bundle. Mark the true dependency gates `[D17]`._

- [√] **(concurrent with Ph1)** Sanity `project` doc: essay (portable text), typed embed blocks (`liveEmbed` = `embedKey` + caption by default; a dedicated typed block only for genuine editorial content `[D15]`), `brandColor` (typed + **validated via the engine's own color pipeline** `[D9]` — _done 2026-06-24 (PR #18): the engine now lives in the shared `@garden/oklch` package the Studio imports `[D23]`_), `fontKey`, `componentKey`, `blurb`, notes, tags; optional `brandColorDark` override `[D5]` (§6)
- [√] **(concurrent)** Sanity `siteSettings` (shell brand, same validation) + notes doc with backlinks via **real `reference` fields** `[D16]` (§6)
- [√] **(concurrent)** Disable stega on `brandColor`/`fontKey`; plan `liveEmbed` click-to-edit as caption-only (§6) `[D16]`
- [√] **(gated on `keys.ts`)** App-side resolvers, never imported by the Studio: typed `satisfies Record<Key, …>` (missing entry = compile error), returning a typed `NotFound` (§4.2, §6) `[D10]`
- [√] **(gated on Ph1 engine)** `cardSwatches(brandColor)` helper: runs the engine (Consumer C), returns a few stops as inline `--c-*`, same parse/validate path, no island / no `<style>` (§3.2, §6) `[D9]` — _done 2026-06-24 (PR #15)_
- [√] `/work` index query: pull `blurb`, `brandColor`, `fontKey` — **not** the essay (§6)
- [√] Key-drift CI check goes **live** (§4.2) `[D10]` — _done 2026-06-24 (PR #16); runtime well-formedness + a comment-stripped `satisfies` tripwire. The published-Sanity-keys-vs-code net stays Phase 4._
- [√] **log-explorer fit-spike:** map its _real_ surface (odd state shapes, embed-prop needs, page shapes) onto the module structure + content model **now, while cheap** — pulls the migration risk forward without doing the full migration (§1, §4) `[D17]`
- [√] **Co-located tests:** resolver (incl. the NotFound path) ✅ / `cardSwatches` ✅ (PR #15) / index-query ✅

_Schema, stega, resolvers, `/work` query, and fit-spike done 2026-06-23 (PRs #10 `49f1071`, #11 `0ff5461`); `cardSwatches` + live key-drift done 2026-06-24 (PRs #15, #16); engine-backed `brandColor` validation done 2026-06-24 (PR #18) — the engine moved into the shared `@garden/oklch` package the Studio imports `[D23]`. **Phase 2 complete.**_

**Exit:** editing a project doc drives brand/font/embeds by key; the `/work` query is
essay-free; `cardSwatches` produces card colors with no scope; the Studio bundle excludes
`next/font` and lazy project bundles; key-drift check green; **the spike confirms the model
can hold log-explorer (or surfaces gaps now, while cheap)**.

---

## Phase 3 — First vertical slice = a dead-simple project _(prove the machinery)_ `[D17]`

_Drive ONE trivial real project end-to-end through the proven keystone, with nothing hard
riding on it, and stand up routing + the shell island. A dead-simple project (static essay,
one brand color, one tiny embed) isolates the routing/Sanity/RSS machinery — the engine
showcase can't, which is why oklch-engine moves to Phase 4._

- [ ] Define the project module skeleton (§4.1): `pages/`, `experience.tsx` (mounted by a thin page), `embeds.ts`, `tokens.css`, `index.ts`. No `core/` unless the trivial experience needs one `[D20]`
- [ ] Build the **dead-simple project**: a trivial real entry (static essay, one brand color, one small embed) — exercises module structure + content model end-to-end
- [ ] Routing: `/work` index (cards via `cardSwatches`); `/work/<slug>` mounts module pages via thin route files (§4.1) — _separate commits_ `[D17]`
- [ ] **Error/empty/loading states** (corrected placement) `[D9, D19]`: `not-found.tsx` via `notFound()` for an unresolved slug/`componentKey`; "missing embed" placeholder in the PT serializer for an unresolved `embedKey`; `error.tsx`/`loading.tsx` for page-level concerns. The ProjectScope/layout throw is already contained by the defensive engine + `unstable_catchError` (Ph0.5/1), **not** by these boundaries
- [ ] **`generateMetadata` per route** (SEO/OG) `[D19]`
- [ ] Theme the shell island through `ProjectScope` with `slug="garden"`; build home, about, `/now` — _separate commits each_ (§2, §3.1, §6) `[D17]`
- [ ] Add an RSS route handler — _own commit_; enable Sanity draft mode / visual editing — _own commit_ (§7) `[D17]`
- [ ] Add `proxy.ts` (replaces `middleware.ts`, Node runtime only; treat Request APIs as async) — deferred from Phase 0 until there is real request logic to host, which draft mode is (§7)
- [ ] Note rendering: notes stay lightweight (shell + shared), pulling a demo bundle only when a note explicitly embeds one (§6)
- [ ] **Co-located test:** one integration/E2E of the primary flow

**Exit:** the dead-simple project renders flash-free at `/work/<slug>` with its own brand
(both schemes) + font through the proven keystone; the `/work` index shows swatch cards; shell
pages are live and themed; RSS + draft mode work; error/not-found/loading states present;
metadata emitted; integration test green.

---

## Phase 4 — Widen & harden

_Add the self-validating showcase and the real migration on proven ground; lock boundaries;
verify performance._

- [ ] **`oklch-engine` as the second slice** — experience is the hue→palette playground that _imports_ the shared engine (never reimplements it); essay embeds the live experience by key; self-themes via the engine it showcases. Doubles as the first "a second project ships without modifying the first" proof (§3.2, §4.3) `[D17]`
- [ ] **Migrate `log-explorer`** — the migration this rearchitecture exists for, now low-surprise because the Phase-2 fit-spike already mapped its surface (§1, §4) `[D17]`
- [ ] Performance / CWV pass — _verification_, since boundaries were enforced from Phase 0: per-face preload only (run the empirical `<head>` check `[D11]`), per-page code-splitting, small `/work` payload (§5, §6, §7)
- [ ] Adopt the §8 "don't reach up" litmus as an advisory PR checklist for shared primitives (the lintable parts already run automatically) (§8) `[D17]`
- [ ] Build the **semantic-color set** when the first status-bearing UI lands (likely the log-explorer migration) — independently seeded, not brand-derived (§3.2) `[D8]`
- [ ] **Key-drift CI net:** GROQ all published `componentKey`/`fontKey`/`embedKey` and assert each exists in code (additive safety net, not a schema change) (§4.2) `[D10]`
- [ ] Let shared primitives and the project-local embed tier accrete only when a second consumer actually appears (§4.1)

**Exit:** boundary lints green; only above-the-fold faces preload; `oklch-engine` and
`log-explorer` both ship without modifying the dead-simple first slice; no shared primitive or
local embed tier introduced without a real second consumer.

---

## Review-surfaced follow-ups

> **The standing home for deferred review findings.** When the pre-PR QA review (the dev↔QA loop,
> [`handbook/working-with-agents.md`](./handbook/working-with-agents.md) §6.2) surfaces something
> real that's genuinely **cross-phase** — it needs a package boundary that doesn't exist yet, a
> future consumer, or later-phase work — the team lead files it here under the phase that should
> pick it up, with its **PR#** and a one-line reason. In-scope findings are fixed in-branch before
> the PR, not deferred. Group new entries by run.

**2026-06-23 run — PRs #8–#11** — surfaced on the Phase 0.5 / parallel build; none blocked their
PR. Run record:
[`runs/2026-06-23-phase-0.5-walking-skeleton.md`](./runs/2026-06-23-phase-0.5-walking-skeleton.md).

**2026-06-24 run — PRs #14–#16** — the gated fast-follows: real `ProjectScope` (Phase 1, PR #14),
`cardSwatches` + live key-drift (Phase 2, PRs #15/#16), and the two minor engine cleanups. The
pre-PR dev↔QA loop ([`handbook/working-with-agents.md`](./handbook/working-with-agents.md) §6.2)
caught three gate-invisible defects — a latent `next/font` build break, a key-drift guard that
false-passed on brace-bearing comments, and a WCAG-AA contrast failure from stub→engine token-name
drift — **all fixed in-branch before their PR**, so nothing from this run is deferred except the
pre-existing Phase-2 `brandColor`-validation package-boundary item below. Run record:
[`runs/2026-06-24-phase-1-projectscope.md`](./runs/2026-06-24-phase-1-projectscope.md).

**2026-06-24 run — PR #18 (solo + fresh QA)** — the last open Phase-2 item, the cross-phase
package-boundary one: engine-backed `brandColor` validation. Extracted the OKLCH engine into the
shared **`@garden/oklch`** workspace package both the app and the standalone Studio depend on
`[D23]`, then swapped the Studio's regex validation for the engine's own pipeline `[D9]`. Solo
(mostly-serial refactor; no disjoint-file split to parallelize), with a **fresh independent QA
pass** (`pr-review-toolkit:code-reviewer`) per §6.2 — it re-ran the gate, probed the `[D14]` guard
fails-closed at the new path, and verified the validation behavior changes. QA surfaced one class
of finding: **doc-rot the move introduced** (living docs still located the engine at the deleted
`src/lib/oklch/`), **all fixed in-branch** (AGENTS.md guardrail, engineering-standards, orientation,
README, architecture-plan, testing). Nothing deferred from this run. Run record:
[`runs/2026-06-24-phase-2-engine-backed-validation.md`](./runs/2026-06-24-phase-2-engine-backed-validation.md).

**Phase 1 — real `ProjectScope` (swaps the stub palette → engine output):**

- [√] Keep the streamed `<style precedence="brand">` string and its `@layer brand { … }` wrapper **synchronized** — done 2026-06-24 (PR #14): single-sourced via a shared `const BRAND_LAYER = "brand"` used by both the template and the `precedence` prop, so they can't desync; a test pins the hoisted style's `data-precedence` `[D13]`
- [√] Map the engine's generic `--brand-*` output into the scope namespace **and** into `--focus-ring-color` (foundation's `:focus-visible` reads it) — done 2026-06-24 (PR #14): `--focus-ring-color: var(--brand-focus-ring)`, browser-verified resolving to a real engine color `[D7]`

**Phase 2 — engine-backed `brandColor` validation (a package-boundary task, not a quick fix):**

- [√] True engine-backed `brandColor` validation — done 2026-06-24 (PR #18). The engine moved
  out of `src/lib/oklch` into a shared workspace package, **`@garden/oklch`** (`packages/oklch`,
  a just-in-time TypeScript-source package; consumers transpile — Next via `transpilePackages`,
  the Studio's Vite/Sanity natively), so the standalone Studio can finally import it `[D23]`.
  `isBrandColorString` now runs the engine's own pipeline (`buildTokenSet`) and accepts iff the
  engine won't fall back — author-time validation equals the render-time contract `[D9]`. The
  `[D14]` isomorphism guard moved with the engine (a dedicated `eslint` block on
  `packages/oklch/**`). _`keys.ts` still awaits its own shared-package move (Phase 4) — this run
  built the package pattern the Studio needed; `keys.ts` can join `@garden/oklch` or take its own
  package when that work lands._

**Phase 3 — content / route housekeeping:**

- [ ] `project.blurb` — consider a hard `rule.max(300).error()` alongside the soft 280-char warning if the card layout can't absorb overflow (PR #11)
- [ ] `siteSettings` — enforce the singleton via Studio Structure and use an explicit `*[_type == "siteSettings"][0]` guard in its query (nothing forces uniqueness today) (PR #11) `[D24]`
- [ ] Draft-mode / Presentation client needs `useCdn: false` + `perspective: "previewDrafts"`, distinct from the publishes-only public client (PR #11) `[D16]`

**Phase 4 — engine playground (Consumer B) performance:**

- [ ] `solveAccent` scans L in 0.01 steps (≈51 × gamut-map + contrast per call) — fine server-side/baked, but for the interactive hue→palette playground memoize or cache the per-hue gamut boundary so it runs at interactive speed (PR #8)

**Minor cleanups (opportunistic, any phase):**

- [√] `palette.ts` — `TOKEN_NAMES` is already typed `readonly BrandTokenName[]`, but the token-set accumulator still used `{} as Record<BrandTokenName, SchemePair>`, so a missing token was **not** a compile error. Done 2026-06-24 (PR #16): rebuilt without the cast so exhaustiveness is type-enforced (verified `TS2322` on a dropped token); output byte-identical
- [√] The OKLCH visual harness wrote `swatches.html` under both the jsdom and node Vitest projects — done 2026-06-24 (PR #16): scoped to the `node` project via `ctx.task.file.projectName`; exactly one write, assertions still run under both projects

---

## Deferred by design — don't build until forced

- **Project-local embed tier** — stay single-tier shared until a second project reuses a widget (§4.1)
- **Shared-primitives library** — lift a primitive on genuine second use, never preemptively (§4.1, §8)
- **A headless `core/`** — only when an experience's logic warrants extraction (§4.3) `[D20]`
- **Semantic-color palette** — slots reserved in Phase 0; built when the first status UI appears (§3.2) `[D8]`
- **Global themeable _brand/feel_ tokens** — none; only the invariant foundation is global (§3.1) `[D1]`
- **Per-route font preload of the resolved face** — not pursued; `preload:false` baseline, manual hint only if a specific face is above-the-fold-critical (§5) `[D11]`
