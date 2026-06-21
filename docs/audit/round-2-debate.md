# Round 2 — Devil's-Advocate Debate

Each auditor received a cross-cutting digest of the others' findings and was asked
to **challenge what they thought was wrong, defend or concede their own findings,
and help the team converge**. Reproduced verbatim. This round is where the plan
actually moved.

## The genuine disagreements going in

1. **Token model (Architect ⇄ Theming).** Architect: maybe per-project foundations
   _don't_ need to be complete — global base + per-project brand/font override is
   simpler. Theming praised "per-island complete token sets" as well-reasoned.
2. **First slice (Architect ⇄ Sequencing).** Architect called `oklch-engine`-first
   "Smart / self-validating." Sequencing called it a validation circularity and
   wanted a throwaway project first.
3. **The trilemma (Theming).** Pure server engine + live per-token override +
   contrast guarantee — pick two. Underpins the whole downward-theming claim.

---

## Architect — debate positions

### MOTION B — What actually varies per project (vs Theming)

**Partial concede, partial hold — and they resolve into one model.**

- **Genuinely invariant across projects:** spacing ramp, motion curves/durations,
  breakpoints, z-index, type-scale _ratios_. House style.
- **Genuinely varies (Theming is right):** the **geometry/feel** set — corner
  radius, border weight, shadow softness, density. A "brutalist" project (0 radius,
  hard shadow) vs a "soft" one feels like its own world _even at the same
  spacing/motion_. That's a real third axis beyond color+font, and it's why islands
  earn their keep.

So **both of us move.** Theming is right that islands need their own scoped sets
(feel varies). I'm right that "complete self-described foundation per island / no
global themeable values" (§3.1) is over-broad.

**Adoptable recommendation — three tiers, not two:**

1. **Invariant foundation → global** (spacing, motion, breakpoints, z-index,
   type-scale ratios, _and_ semantic colors). Themeable-in-principle but
   invariant-in-practice.
2. **Brand → engine-scoped** (color from OKLCH + font).
3. **Feel/geometry → scoped, small override set** (radius, border, shadow,
   density), defaults inherited from tier 1.

This rewrites §3.1's rule from "no global themeable values" to "no global
**brand/feel** values; invariant foundation IS global." It subsumes my F2: the
coordination-layer exception isn't an exception, it's tier 1.

### MOTION C — oklch-engine first (vs Sequencing)

**Largely concede.** Sequencing has the better of it, consistent with my own F8.

- **Walking skeleton before Phase 1: fully concede.** The biggest _integration_
  risk is the flash-free RSC scoped-`<style>` render, not the color math. A stub
  ProjectScope emitting a hardcoded palette retires that risk _without_ the engine.
- **Validation circularity: concede the ordering, narrow the charge.** The engine
  is a _pure function_ and Phase 1 already mandates isolated unit tests, so
  engine-correctness is retired in isolation. BUT the content/routing layer
  (Sanity componentKey resolution, RSS, cardSwatches) is not covered by engine
  tests; if the first real slice is _also_ the engine showcase, a Sanity-resolution
  bug and an engine bug both surface as "page broken." That residual circularity is
  real.
- **Net:** first real slice = a **dead-simple project** (a button, not a playground)
  to isolate routing/Sanity/RSS. **oklch-engine second.** My "smart" was right about
  end-state value, wrong about sequencing position.

### THE TRILEMMA (Theming F9) — and it sharpens my F1

The trilemma only bites **if you actually need runtime re-derivation of derived
tokens. You don't.** Theming runs the engine once per scope on the server; the only
browser-side use is the playground, which **re-invokes the pure function**. So
nowhere does the system need to override a mid-chain derived token and have its
derivatives recompute. The §1/§3.3 "downward per-token override" was always
**composition-time**, not runtime re-derivation.

**Decision: pick lane 1 — bake literal `oklch()` values server-side.** Get contrast + gamut guarantees; lose runtime re-derivation, which isn't needed.

**This resolves my F1 too.** The public override surface = **leaf consumable
tokens** (`--brand-accent`, `--font-face`), NOT the engine's internal derivation
chain. Reframe: _override the **seed** (re-run engine, server-side per scope) OR
override a **leaf literal** — never a mid-chain derived token._ `--logx-*` is
internal aliasing of the leaf layer; the generic names are the contract.

### Other findings — endorse / push back

- **FrameworkFit ① (runtime fontKey breaks build-time preload): concede I
  underweighted §5.** A MAJOR my audit missed.
- **Theming F4 (unlayered CSS Modules beat all `@layer` styles): endorse, real
  correctness trap.** Must be enforced (lint/build), not assumed.
- **Theming F3 (semantic colors): endorse — slots into MOTION B tier 1.** The
  engine shouldn't touch them.
- **ContentModel (referential integrity / engine-throws-500): endorse, mild
  de-escalation.** The pure engine should clamp or return a Result, never throw on
  editor input. Real but MINOR with the guards in place.
- **Theming F2 (dark mode): mild push-back.** Only a defect if dark mode is in
  scope. Treat as a **decide-now** so the engine signature isn't retrofitted later.

**Organizing meta-point I'll endorse from Sequencing:** sequence by
**risk-retirement, not dependency topology.**

---

## Theming — debate positions

### ASSIGNMENT 1 — THE TRILEMMA (F9), LANDED: pick lane (a), bake literals

**Recommendation: (a) bake resolved `oklch()` literals server-side, gated by
validation in `ProjectScope`. Treat (b) relative-color CSS as an optional
micro-optimization for decorative deltas only — never the architecture. Reject
(b)-as-architecture and reject a 50/50 hybrid.**

The decisive realization: **live per-token CSS override is a solution to a problem
this project doesn't have.** Every consumer that changes a color:

- Theming feature → engine runs **server-side**, per scope.
- oklch-engine playground → re-runs the engine in **JS** on each slider move.
- Card swatches → `cardSwatches()` re-runs the engine in **JS**.

Nothing depends on CSS _cascade_ re-derivation. Option (b)'s entire selling point
buys a capability no consumer uses, in exchange for surrendering F1 (contrast) and
F5 (gamut). Option (a) also **lands ContentModel's validation finding for free**: a
server-side engine is the single choke point to parse + gamut-validate the
brandColor and fall back to a safe default.

**The honest hybrid:** literals for everything legibility-bearing (text, on-brand,
focus-ring color, semantics, surfaces) — contrast-solved and gamut-mapped at emit
time. Relative-color (`oklch(from var(--surface) calc(l - .05) c h)`) permitted ONLY
for decorative, non-contrast deltas (hairline borders, subtle tints). Lead with
literals; relative-color is a footnote.

**Concession on my own F9:** the `var(--public, var(--default))` indirection should
STAY — but only for its real job (downward theming of primitives by swapping _which_
token they read). Drop the overstated claim that it "generalizes to the whole
system" as live ramp re-derivation. It composes; it does not recompute.

### ASSIGNMENT 2 — MOTION B (vs Architect): he's mostly right. Scope BRAND+font, share FOUNDATION

**Steelman:** ~5 projects share ~90% of foundation; only `brandColor` + `fontKey`
vary. Re-declaring a complete foundation in every island is real cost to solve
per-project _foundation_ variation that doesn't exist in the spec. The plan itself
says "right-sized, not maximal" (§1).

**My honest verdict: the OKLCH-per-scope need justifies scoping the BRAND ramp only
— not the whole foundation.** What I praised was avoiding the trap of _themeable_
values fighting at a shared `:root`. Invariant spacing/type/motion aren't
themeable-that-vary; they're shared invariants — which §3.1's _own_ escape hatch
already permits. Correct shape:

- **Global `:root`:** shared foundation (spacing, type scale, motion) as defaults.
- **`[data-project]` scope:** brand ramp (always) + font (always) + foundation
  overrides **only where a project genuinely differs**.

**Two guardrails so the team doesn't over-correct:**

1. **Keep the scope machinery** — the `[data-project]` wrapper + scoped `<style>` is
   still required for the brand ramp.
2. **Bonus convergence:** sharing foundation shrinks every island's `<style>` to
   just the brand ramp — helps F6/F7.

**This also resolves Architect's contract ambiguity:** the PUBLIC contract a shared
embed codes against is the **generic layer** — `--brand-*`, `--font-face`, shared
`--space-*`. `--logx-*` is an internal alias.

### ASSIGNMENT 3 — PRIORITY CUT: F2 now > F8 now (cheap) > F3 defer

- **F2 dark mode — MUST DECIDE NOW (signature-blocking).** Determines the engine
  signature and the emitted block shape. Even "light-only for v1" must be an
  _explicit_ decision now.
- **F8 focus-ring color — DECIDE NOW, but it's one line.** The engine emits
  focus-ring color as one of its contrast-solved tokens; geometry stays global.
- **F3 semantic colors — DEFER building, but decide ONE thing now: they are NOT
  brand-derived.** Reserve the slot; build them when the first status-bearing UI
  appears (likely log-explorer, Phase 4).

### Digest findings I'd refine

- **F7 — I downgrade my OWN concern (concede).** FrameworkFit is decisive: React 19
  dedupes `<style>` by `href`+`precedence`. Just mandate the `precedence` API.
- **FrameworkFit's font-preload "likely breaks" — refine to "degrades to swap," and
  it's conditional.** If `/work/<slug>` is statically generated (`generateStaticParams`),
  the resolved face per route IS build-time knowable and preload works again. Pin
  that down rather than declaring preload dead.
- **ContentModel's "invalid brandColor → 500" — fully endorse.** Strongest argument
  FOR lane (a).
- **Sequencing's visual+contrast harness as Phase-1 exit — strongly endorse.** Feed
  3–4 brand colors spanning the hue wheel (incl. a yellow and a cyan, the
  contrast-stressers) and assert APCA Lc / WCAG ratios on every pair _after_
  gamut-mapping.

---

## ContentModel — debate positions

### 1. KEY-DRIFT FIX — concrete, with blocking line

**The single highest-leverage move is the compile-error one, and it's free.** Make
`keys.ts` the single source of truth and type every resolver as `Record<Key, …>`. A
missing resolver entry then fails `tsc`/CI — converts the _code→code_ drift direction
from a runtime crash into a build break. But the compile check **cannot** catch the
_content→code_ direction (a key in a saved Sanity doc whose code was later
deleted/renamed) — that gap is what the runtime fallback and the CI-vs-Sanity check
exist for.

**DO NOW (Phase-2-blocking — schema/contract shape):**

1. Typed resolvers keyed by `keys.ts` (`satisfies Record<Key,…>`) — compile-error on
   missing entry.
2. Resolvers return a typed not-found, never bare `map[key]` — `resolve(key):
Resolved | NotFound`. An API-shape decision; every call site is written against
   it from day one.
3. A visible fallback at each render seam: (a) `componentKey`/slug miss →
   `not-found.tsx` on `/work/<slug>` (also closes Sequencing's unscheduled
   not-found gap); (b) `embedKey` miss inside the essay → a "missing embed"
   placeholder in the Portable Text serializer. The _contract_ (resolvers return
   NotFound) is Phase 2; the render UI is Phase 3.

**LATER (Phase 4 — operational safety nets, additive):** 4. CI check: GROQ all distinct published keys → assert each exists in code. Only
useful once there's real content, post-Phase-3. 5. Key renames as `sanity migration` scripts. Document the rule now, build when the
first rename happens (Phase 4).

The principle: **anything that shapes the resolver API or document schema is
blocking; anything that's a CI job or runbook is deferrable because it's additive.**

### 2. brandColor VALIDATION — reconciled with Theming's gamut point

Theming is right: **`@sanity/color-input` alone is NOT enough** — its picker is
sRGB-hex, so it can't express the wide-gamut colors you'd want an OKLCH engine for,
and doesn't guarantee the value survives the engine's contrast math. Three layers:

- **Type:** a validated string (hex or `oklch()`) OR `@sanity/color-input` — fine for
  input, neither sufficient for correctness.
- **Author-time custom validation (the real fix):** a Sanity `validation` rule that
  runs the **same color lib the engine uses** — parse, gamut-map/clamp, confirm the
  engine can produce in-spec contrast. The only place an editor gets feedback.
- **`ProjectScope` defense-in-depth:** the engine gamut-maps internally and
  `ProjectScope` falls back to a default brand if the engine still throws.

Net: gamut-mapping lives **in the engine**, validation **mirrors it at author time**,
and `ProjectScope` **catches** anything that slips through. Same for `siteSettings`
brand and `cardSwatches`.

### 3. Decision rule: typed block vs generic liveEmbed

The line is **authored content vs. code-owned config**:

> Use generic `liveEmbed` (`embedKey` + caption) when the only authored inputs are
> the key and a caption — the widget's behavior is fully determined by code. Covers
> the demo and the majority of in-essay embeds. Zero schema change to add one.
>
> Give a widget its own typed block ONLY when an editor must author structured
> content that lives in the CMS — text they write, an image they pick, a list they
> curate.
>
> Never model code-level configuration (variants, sizes, initial state) as a block
> _or_ a props blob — default it in the registry; if it must vary per placement,
> that's two registered keys, not one parameterized embed.

Litmus: _"Is this input something an editor writes/curates, or something a developer
decides?"_ Editor → typed block. Developer → registry. Neither → it's not an input.

### Pushback on the digest

- **FrameworkFit ① (runtime fontKey defeats preload):** correct, but it doesn't
  change how I'd _model_ `fontKey` — the content stays a key; the fix is on the
  resolution side. Model unchanged, note the preload caveat, don't over-rotate.
- **Architect F1 (embed can't read `--logx-*`):** real, the embed-side mirror of my
  namespacing concern. A _shared_ embed must theme off the **generic** tokens; the
  two-tier `{...shared, ...projectLocal}` override is fine if project-local may shadow
  a shared key of the same name and namespacing prevents _accidental_ shadowing.
- **Theming dark mode (per-scheme doc field):** **do NOT add a per-scheme field.**
  Scheme is a _render-time_ axis; one `brandColor` should generate both light and
  dark ramps. If a project needs a hand-tuned dark brand, model it as an _optional_
  `brandColorDark` override, not a required parallel field.

No Sanity/visual-editing errors in the digest to flag — my §7 stega/Presentation
finding stands.

---

## FrameworkFit — debate positions (doc-verified)

### 1. FONT PRELOAD — concrete joint recommendation (my ① + Theming F10 converge)

- **`preload: false` on every roster face by default.** Neutralizes Theming F10's
  fear (roster imported by ProjectScope on every route) not by avoiding the import
  but by `preload:false` — the import is free ("declaration ≠ download"). `preload`
  defaults to **`true`** (font.md `### preload`), so you MUST set it explicitly.
- **Only the shell's 1–2 identity faces get `preload: true`**, in the root layout.
- **Apply the resolved per-project face via its `.variable` class**, not
  `.className`: `ProjectScope` sets `className={roster[fontKey].variable}` and
  `--logx-font` maps to that face's `--font-*` var.
- **Why not per-route preload of the resolved face:** preload is build-time static
  analysis keyed to which font object a route statically references; `fontKey→face`
  is a **runtime** Sanity lookup. Project essay text below the fold tolerates
  `display:swap`.
- **Empirical check (before Phase 4 banks CWV on this):** `pnpm build`, visit
  `/work/<slug>`, view-source the `<head>`, count `<link rel="preload" as="font">`.
  Plan's claim predicts **exactly one**; realistic outcomes: **zero** (with
  `preload:false`) or **all roster faces the module references**.

### 2. THEMING F4 & F7 — ground-truth verification

**F4 (unlayered CSS Modules beat layered styles) — VERIFIED CORRECT. Load-bearing.**

- `01-getting-started/11-css.md`: CSS Modules "generate unique class names" — nothing
  more. The "Ordering and Merging" section describes ordering purely by **import
  order**, with **zero mention of `@layer`**. Next does **not** wrap CSS Modules in
  any cascade layer.
- Per the cascade spec, **unlayered normal declarations outrank every `@layer`**. So
  a component `.button { color: red }` in an unlayered `*.module.css` beats `@layer
project { … }` — silently, regardless of specificity or source order.
- _Fix:_ any component CSS Module that sets real properties must wrap its body in
  `@layer project { … }`, OR components stay strictly var-_consuming_. Add to the §8
  litmus. "CSS-vars-only, no Tailwind" doesn't exempt it.

**F7 (streamed scoped `<style>` may paint late) — PARTLY CONFIRMABLE; refine to
conditional.**

- `11-css.md` documents only `<link rel="stylesheet" href>` as the React-19
  stylesheet-as-resource path; it does **not** document `<style precedence>`. So
  React's `<style href precedence>` behavior is **React 19 behavior, not confirmable
  from the installed Next docs** — flag it as such.
- **Dedupe is the wrong frame here** — each project's block is unique. But `precedence`
  **requires an `href`**, so set one — use the **slug** (`href={`theme-${slug}`}`) —
  buys idempotency if a scope renders twice.
- **Hoisting doesn't break scoping** (rules are `[data-project="x"]`-scoped).
- **Flush-before-paint is only a concern inside a Suspense/streamed boundary.** If
  `ProjectScope` renders in the initial shell _above_ any Suspense (the common case),
  the inline `<style>` is already in the streamed HTML before the content it themes —
  no late paint, plain inline is fine. Precedence becomes the right tool **only if**
  ProjectScope can be suspended/deferred. The walking skeleton should prove this.

### 3. CONTENTMODEL — 500 blast radius & containment (`10-error-handling.md`)

- **Blast radius:** an uncaught throw in `ProjectScope` (Server Component) bubbles to
  the nearest parent error boundary. If none up to root, `global-error.js` replaces
  the **entire document** — effectively the 500.
- **Critical gotcha:** `error.tsx` is a Client Component rendered **inside** its
  segment's layout, so it does **NOT catch errors thrown by the layout/template of
  its own segment.** If `ProjectScope` lives in `/work/[slug]/layout.tsx`, that
  segment's own `error.tsx` won't catch it.
- **Also:** even when caught, the error fallback renders **unthemed** — ProjectScope
  is the thing that themes.
- **Correct Next-16 containment (two layers):**
  1. **Primary — defensive engine:** validate/clamp `brandColor` inside the engine and
     **return a safe fallback palette, never throw.** A bad Sanity color is expected
     data, not an exceptional bug.
  2. **Backstop — component-level boundary:** Next 16 ships **`unstable_catchError`
     from `next/error`** to wrap any subtree in a boundary without a segment
     `error.tsx`. Wrap ProjectScope with it. Don't rely on `error.tsx` alone given the
     layout-doesn't-self-catch rule.

### Cross-checks

- **Architect F3 (isomorphic engine unenforced) — endorse, with one refinement.** A
  dual-environment Vitest run (engine suite under `environment: 'node'` AND `'jsdom'`)
  is the cheap high-signal check. Add an ESLint import-boundary on `src/lib/oklch/`
  forbidding `next/*`, `react`, `react-dom`, DOM/Node globals. **Do NOT reach for
  `import 'server-only'`/`'client-only'`** — those _pin_ a module to one side and would
  actively break the isomorphic requirement.
- **Sequencing (walking skeleton) — endorse, but retarget it.** Basic
  "server-rendered color is flash-free" is already solid (my ⑥) — don't spend the
  skeleton proving that. Point it at the two genuinely version-dependent unknowns: (a)
  the React 19 `<style precedence>` + Suspense flush-before-paint, and (b) the
  @layer-vs-unlayered-module cascade.

Tight version: the plan's framework reading is sound; the only things that need to
_change_ are making the font roster `preload:false`-by-default, CSS Modules
`@layer`-wrapped, and a defensive engine instead of a throwing one. Everything else is
"verify by inspection," not "redesign."

---

## Sequencing — debate positions

### Up front: one concession that reframes my thesis

My original framing — "the engine is a pure function you can nail in isolation, so the
_real_ scary part is the RSC render" — is **wrong, and I retract it.** Theming is right
that the engine is genuinely hard; FrameworkFit is right that the scoped `<style>` is
genuinely flash-free. Both cut the same way: **the color-science correctness is the
bigger risk; the RSC render is largely solved.** That sharpens my proposal.

### 1. MOTION C — head-to-head with Architect

**I concede the throwaway project. Architect keeps oklch-engine as the first real
slice. The walking skeleton is what makes us both right.**

The disagreement was never "throwaway vs oklch-engine" — it was _where the
slice-machinery integration gets de-risked_. Insert a **Phase 0.5 walking skeleton**:
a stub ProjectScope (hardcoded palette, no engine) + one hardcoded module shell,
rendering through a thin `/work` route. That proves routing + ProjectScope + Sanity +
module structure **in isolation, with a stub, more cheaply than a full throwaway
would.** Then Phase 1 proves the **engine**; Phase 3 composes **two already-proven
things** → oklch-engine-as-first-slice is now safe _and_ self-validating.

**Synthesis = skeleton (0.5) → engine (1) → oklch-engine first real slice (3). No
throwaway.** Architect wins the Phase 3 call; I win the decoupling; the throwaway
dies.

### 2. RECONCILE the risk question — top 3 to retire earliest

1. **Engine color-science correctness** (Phase 1) — _now the root risk._ Decide
   dark-mode signature, semantic slots, gamut mapping, contrast-as-constraint up
   front; validate against **observable output** (visual harness over 3–4 brand
   colors + contrast assertions), not determinism alone. This is why "engine early"
   is actually _correct_ — the flaw was never "engine first," it was "engine first
   with a determinism-only exit criterion."
2. **Slice-machinery integration** (Phase 0.5) — routing + ProjectScope + Sanity +
   module structure composing through one real request.
3. **ProjectScope-on-bad-input → 500** (Phase 0.5/1) — ProjectScope must degrade to a
   safe default the moment it exists.

**The RSC flash-free render drops off the "retire first" list** — keep only a
_one-commit empirical check_ in 0.5.

### 3. REVISED SEQUENCE

**Phase 0 — Scaffolding + guardrails** _(bundle all enforce-from-start rules here)_

- Existing Phase 0 tasks (app, proxy.ts, :root, @layer order, Sanity+TypeGen, shell
  skeleton)
- **+ CI gate** (lint/format/typecheck/test/build on PRs) — from commit #1
- **+ boundary lints** (no project→project, no shared→project)
- **+ @layer-declaration lint** (every CSS module declares its layer)
- **+ key-drift CI check** (keys.ts ↔ resolvers) — stubbed now, live in Phase 2
- _Exit:_ app deploys; CI green; guardrails active even while guarding little.

**Phase 0.5 — Walking skeleton** _(NEW)_

- Stub ProjectScope (hardcoded palette, no engine) + one hardcoded module shell
  through a thin `/work/<slug>` route
- Empirically confirm flash-free SSR + clean hydration; inspect real `<head>` for
  font-preload behavior
- Missing/invalid seed → safe fallback, **no throw**
- _Exit:_ hardcoded project renders flash-free through stub scope on Vercel; no
  hydration flash; ProjectScope never throws on bad input.

**Phase 1 — Theming keystone (engine + real ProjectScope)**

- Build engine; **decide dark-mode signature / semantic slots / gamut mapping /
  contrast-as-constraint up front**
- Swap stub palette → engine output; bake brandColor validation + fallback into
  ProjectScope
- **Co-located tests:** engine unit + isomorphism + contrast assertions
- **Visual harness** over 3–4 brand colors as the observable-output exit
- _Exit:_ engine returns contrast-valid token set incl. dark mode; harness proves
  palette quality; ProjectScope flash-free for a real color **and** degrades safely.

**Phase 2 — Content model + resolvers** _(parallel with Ph1, honest gates)_

- Sanity schema/doc modeling + keys.ts → **genuinely concurrent**
- resolvers (gated on keys.ts), cardSwatches (gated on Ph1 engine) → **mark the gates**
- key-drift CI check goes live
- **+ log-explorer fit-spike** (paper/spike mapping its _real_ surface onto the module
  - content model) — pulls the migration risk forward
- **Co-located tests:** resolver / cardSwatches / index-query
- _Exit:_ key-by-key drives brand/font/embeds; index essay-free; key-drift green;
  spike confirms the model can hold log-explorer (or surfaces gaps now, while cheap).

**Phase 3 — First vertical slice = oklch-engine** _(Architect's call, now de-risked)_

- Module skeleton → experience → essay embed → registry entry — **separate commits**
- Routing `/work` index + `/work/<slug>`
- **error.tsx / not-found.tsx / loading.tsx land here**; unresolved key → not-found,
  not 500
- Shell island; home / about / `/now` — **separate commits**; RSS — own commit; draft
  mode — own commit
- **+ generateMetadata per route**
- **Co-located test:** one integration/E2E of the primary flow
- _Exit:_ oklch-engine renders flash-free; experience embeds inline; index shows swatch
  cards; shell live; RSS + draft mode work; error/not-found/loading present; metadata
  emitted; integration test green.

**Phase 4 — Harden & widen**

- CWV/perf pass (boundaries already enforced since Ph0 → _verification_, not setup)
- **Full log-explorer migration** — now low-surprise because the Ph2 spike mapped it
- Accrete shared embed tier / primitives only on genuine second use
- _Exit:_ boundary lints green; only above-fold faces preload; second project ships
  without touching the first.

### Where the digest is overstated

- **My own old framing** — retracted; the engine is the scary part, not the RSC
  render.
- **Architect's "oklch-engine-first is self-validating"** — true only after plumbing
  and engine are independently proven. With the skeleton it's correct. We both move
  one step.
- **Deferred-by-design: less disagreement than it looks.** Architect and I agree on
  _what to defer_ (lift embeds/primitives/global tokens on genuine second use). We
  differ only on _enforcement_: separate **"what to build" (defer — agreed)** from
  **"what to enforce" (boundary/@layer/key-drift lints — from Phase 0).** The human
  litmus checklist can stay advisory; the parts that _can_ be a lint rule _should_ be,
  early.

**Bottom line:** skeleton → engine → dead-simple-first → oklch-engine-second; engine
correctness is the root risk (validate against observable output); guardrails bundled
into Phase 0; tests co-located per phase; ProjectScope fallback + error/not-found
scheduled where routing/data appear; log-explorer de-risked by an early fit-spike with
the full migration staying in Phase 4.

> **Note — this first revised sequence was superseded by Sequencing's closing
> artifact below.** In this version Sequencing momentarily characterized the Motion C
> resolution as "Architect keeps oklch-engine as the first real slice," which
> contradicted what Architect actually conceded ("first real slice = a dead-simple
> project… oklch-engine second"). The closing artifact reconciles them. Read it as
> authoritative.

---

## Sequencing — closing artifact (authoritative final sequence)

Both convergences folded in. Motion C is now fully settled (Architect conceded to
dead-simple-first / oklch-engine-second / skeleton-before-Phase-1). FrameworkFit's
retarget of the skeleton and the error-containment correction are accepted.

### Motion C — RESOLVED (no daylight left)

Walking skeleton (stub) → **dead-simple real project as first slice** → **oklch-engine
as second slice**. The dead-simple project proves the vertical machinery against _real
data_ with nothing hard riding on it; oklch-engine moves to second, where it does its
self-validating-showcase job _and_ doubles as the "a second project ships without
touching the first" proof. Engine-correctness risk (Phase 1) and integration risk
(Phase 0.5) are both already retired before either slice is built.

### Top-3 risks to retire earliest (final)

1. **Engine color-science correctness** (Phase 1) — root risk; validate against
   _observable output_. Decide dark-mode signature / semantic slots / gamut mapping up
   front.
2. **Two version-dependent render unknowns** (Phase 0.5) — (a) React 19 `<style
precedence>` + Suspense flush-before-paint, and (b) the @layer-vs-unlayered-module
   cascade trap. Empirical proof on the exact Next 16 / React 19 build. _Not_
   flash-free-color (already solid).
3. **brandColor containment** (Phase 0.5/1) — a layout's own throw is NOT caught by
   `error.tsx`. Containment = defensive engine/ProjectScope that returns a fallback and
   never throws + `unstable_catchError`, not a segment error boundary.

### Revised phase list (closing)

**Phase 0 — Scaffolding + guardrails.** Existing tasks + CI gate + boundary lints +
@layer-declaration lint + stubbed key-drift check. _Exit:_ app deploys; CI green;
guardrails active.

**Phase 0.5 — Walking skeleton (NEW, retargeted).** Stub ProjectScope (hardcoded
palette, no engine) + one hardcoded module through a thin `/work/<slug>` route. Prove
the two version-dependent unknowns; ProjectScope returns a safe fallback on
missing/invalid seed — never throws. _Exit:_ renders through stub scope on Vercel with
verified precedence/flush + correct layered cascade; provably never throws.

**Phase 1 — Theming keystone (engine + real ProjectScope).** Decide dark-mode
signature / semantic slots / gamut mapping / contrast-as-constraint up front; swap stub
palette → engine (stays defensive, never throws); co-located unit + isomorphism +
contrast tests; visual harness over 3–4 brand colors = the observable-output exit.

**Phase 2 — Content model + resolvers** _(parallel with Ph1, honest gates)_. Schema +
keys.ts concurrent; resolvers/cardSwatches gated on their deps (marked); key-drift check
goes live; **+ log-explorer fit-spike**; co-located resolver/cardSwatches/index-query
tests.

**Phase 3 — First vertical slice = dead-simple project.** A trivial real project
(static essay, one brand color, one tiny embed) end-to-end: module skeleton → routing
`/work` + `/work/<slug>` → shell island → home/about/`now` (separate commits each) →
RSS (own commit) → draft mode (own commit) → `generateMetadata`. `not-found.tsx` for
unresolved slug via `notFound()`; `error.tsx`/`loading.tsx` for page-level concerns —
the ProjectScope/layout throw is already contained by the defensive engine +
`unstable_catchError` from Ph0.5/1, **not** by these boundaries. One integration/E2E
test.

**Phase 4 — Widen & harden.** **oklch-engine as the second slice** (self-validating
showcase; first "second project ships without touching the first" proof); **full
log-explorer migration** (low-surprise, mapped by the Ph2 spike); CWV/perf pass
(_verification_ — boundaries enforced since Ph0); accrete shared tiers only on genuine
second use.

**One-line spine:** guardrails-first Phase 0 → stub skeleton retires the two
React-19/@layer unknowns (0.5) → engine retired against observable output (1) → content
model + log-explorer fit-spike (2) → dead-simple first slice proves the machinery (3) →
oklch-engine + real migration widen on proven ground (4). Risk-retirement order, not
dependency-topology order — adopted across the panel.
