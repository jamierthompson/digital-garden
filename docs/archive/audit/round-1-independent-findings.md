# Round 1 — Independent Findings

Each auditor reviewed `../architecture-plan.md` and `../build-phases.md` through
one lens, **before** seeing any other auditor's work. Reproduced verbatim.
Severity scale: CRITICAL / MAJOR / MINOR / NIT.

---

## Architect — abstraction altitude, coupling/cohesion, right-sizing

### Verdict

Sound at its load-bearing core but over-conceptualized at its edges. The genuinely
clean parts (engine dependency direction, the reference-by-key/Studio-bundle
split, the deferred-by-design phasing) are wrapped in a vocabulary heavier than
the machinery it ships. The _built_ surface is small — a `ProjectScope` server
component + a pure engine + two registries; the _conceptual_ surface (themed
islands, self-sufficient contracts, the don't-reach-up litmus, downward theming)
is large and, in two places, internally contradictory as literally written. Not
under-specified on principles — if anything over-specified — yet it leaves the one
contract that matters most (which token names are the public interface) genuinely
ambiguous.

### Findings

**F1 — MAJOR — Public token contract is ambiguous: `--logx-*` vs `--brand-*`/`--font-face`** (§3.1, §3.3, §5, §6)
Self-sufficiency ("a shared primitive works composed into any project, or none,"
§3.3) requires shared units to read _generic, project-agnostic_ names. §6 supports
this — "everything beneath reads `var(--brand-*)` / `var(--font-face)`." But §3.1
and §5 repeatedly say everything reads the _project-prefixed_ `--logx-*` ("one
namespace, read by every page + embed"; "each reads the project's font token
`--logx-font`"). A **shared cross-project embed cannot read `--logx-font`** — it
doesn't know the prefix. So either embeds read generic names (and `--logx-*` is
just an internal alias the project maps from `--brand-*`), or shared embeds are
secretly coupled to a specific project's namespace, violating the doc's own
central rule. This is the contract the whole island model rests on, and it's the
least-pinned-down thing in the plan.
_Rec:_ State explicitly that the **public contract is the generic layer**
(`--brand-*`, `--font-face`); `--logx-*` is a project-internal convenience mapped
from it; shared units read _only_ generic names.

**F2 — MAJOR — "No global themeable values" is the load-bearing bet, and it's punctured by your own coordination layer** (§1, §3.1, §8)
Everything follows from one axiom: _do not put themeable values at `:root` for
islands to override_ (§3.1). But §1 states it absolutely — "Nothing depends on
ambient context provided by an ancestor it doesn't own" — and §8's litmus checks
"avoid assuming any **ambient ancestor context (a parent `:root` value)**." The
§3.1 coordination layer (z-index, reset, focus-ring at `:root`) **is** ambient
ancestor context every unit depends on and doesn't own. The themeable-vs-plumbing
carve-out resolves the _intent_, but the §1 absolutism and the §8 checkbox both
contradict it as written — a reviewer applying the litmus literally fails the
coordination layer.
_Rec:_ Rewrite the §1 principle and the §8 checkbox to say _themeable_ ambient
context, baking the plumbing carve-out into the rule itself instead of as a §3.1
exception.

**F3 — MAJOR/MINOR — The isomorphic-engine constraint is load-bearing but unenforced** (§3.2)
Consumer A (server theming) and B (browser playground) both run the same engine,
so it "must be isomorphic — no server-only/DOM-only deps." Asserted as discipline
with nothing enforcing it. One `import` of a Node color lib, `fs`, or a DOM
measurement silently breaks either the playground or all server theming — and the
lint-import boundaries (§7, Phase 4) catch cross-folder imports, not dependency
_nature_.
_Rec:_ Keep `src/lib/oklch/` pure-JS, no-deps (or pure-deps-only), and add a test
that imports and runs it in _both_ a node and a jsdom/edge context. Treat "runs
identically server and client" (Phase 1 exit) as a _test_, not a hope.

**F4 — MINOR — Mandating a headless `core/` per project is ceremony for simple demos** (§4.1, §4.3)
§4.3 is admirably honest ("internal hygiene only, not for any packaging or reuse
goal"), but §4.1 templatizes `core/` into every module. A toggle/slider demo
doesn't need a state machine in a separate folder. Contradicts §1's own
"concentrate sophistication where it pays… let the rest be boringly simple" and
the deferred-by-design ethos applied everywhere else.
_Rec:_ Let `core/` **emerge** when an experience's logic warrants extraction —
same rule as the project-local embed tier and shared primitives. Don't pre-carve
it into the template.

**F5 — MINOR — `experience.tsx` vs `pages/` is a cohesion smell** (§4.1)
The module diagram lists both `pages/` ("the experience, plus any essay/hero")
_and_ a sibling `experience.tsx`. So "the experience" is simultaneously a page and
a top-level component beside the pages. Is the experience _in_ `pages/`, or mounted
_by_ a page from the sibling file? Unclear — and it's the one constant every
project has.
_Rec:_ Pick one: `experience.tsx` is the component and `pages/` mounts it (then
drop "the experience" from the `pages/` description), or the experience is just a
page.

**F6 — MINOR — Three naming schemes for one engine output; Consumer C's "minimal" is payload-only** (§3.2, §6)
Engine output appears as `--brand-*` (generated), `--logx-*` (mapped), and `--c-*`
(card swatches) — mapping logic in three places. Separately, "each taking only as
much output as it needs" oversells C: `cardSwatches` runs the **full** engine and
discards all but a few stops. The lightness is real at the _payload/DOM_ layer (no
`<style>` block, essay-free query) but not at _compute_.
_Rec:_ Reword C to "emits only a few stops" and note it still runs the whole
engine; consider unifying `--c-*` with `--brand-*`.

**F7 — NIT — Prose preaches minimalism; vocabulary invites future gold-plating** (§1, §8)
The plan _does_ hold the line on shipped artifacts (deferred-by-design,
lift-on-second-use, single-tier registries — genuinely disciplined). But the
conceptual load — themed islands, self-sufficient contracts, downward-theming
ownership, the six-item litmus — is heavy for ~5 projects. The risk isn't the code;
it's litmus-lawyering becoming a tax on trivial changes.
_Rec:_ Keep the artifacts, trim the ceremony. Phase 4 already treats the litmus as
a one-time PR checklist — keep it advisory and scoped to shared primitives (as §1
says), not every component.

**F8 — NIT — "Trivially flash-free" asserted as settled; it's the keystone** (§3.2, §7, Phase 1)
The flash-free server-rendered scoped `<style>` block is the integration keystone
(Phase 1 exit). The doc states it as solved fact. Multiple islands each emitting a
streamed `<style>` block is _probably_ fine under RSC but unproven until built.
Credit: the plan **front-loads exactly this risk** in Phase 1 — right call.
_Rec:_ Keep proving it, not assuming it — verify with multiple islands on one page
(`/work` index) early.

### Strongest assumption to challenge

**That brand/foundation vary enough per project to justify rejecting a global
`:root` theme with per-project overrides (§3.1).** Every piece of machinery —
scoped style blocks, downward theming, self-sufficiency, the litmus — is
downstream of one sentence: "do **not** put themeable values at a global `:root`
that islands then override." If in practice the handful of projects share ~90% of
their foundation (spacing, type scale, motion) and differ only in `brandColor` +
`fontKey`, then the _banned_ pattern — a global base plus a tiny per-project
override layer — is dramatically simpler, and the island apparatus is solving a
problem a small portfolio doesn't have. The OKLCH-per-scope need is real and
justifies _brand_ tokens being scoped; it does not obviously justify each island
carrying a **complete, self-described foundation**. Stress-test: _what actually
differs per project beyond brand color and font?_ If "not much," the altitude is
too high and §3.1's prohibition should soften to "scope brand, share foundation."

### What's genuinely good (preserve)

1. **Engine dependency direction (§3.2).** Pure function depends on nothing;
   theming/playground/cards depend on it; the explicit anti-pattern callout
   (engine-inside-project, theming reaching up) is correct, and the self-theming
   demo is elegant _without_ being circular. Best-designed part of the plan.
2. **Reference-by-key with the `keys.ts`/resolver split (§6).** Keeping
   `next/font` and lazy project bundles out of the Studio bundle via a
   string-constants contract — real, measurable bundle benefit and a clean
   content/code seam.
3. **Deferred-by-design + critical-path phasing.** The plan actively resists its
   own purism with concrete "don't build until forced" gates, and sequences engine
   → `ProjectScope` → first slice correctly.

---

## FrameworkFit — Next.js 16.2.9 / React 19.2.4 / Vercel fit

Verified against `package.json` (`next@16.2.9`, `react@19.2.4`) and the
version-matched bundled docs under `node_modules/next/dist/docs/`.

### Verdict

The plan is unusually well-aligned with the _actual_ installed framework — the
author clearly read past their training data. The headline Next.js 16 claims
(proxy rename, async request APIs, Turbopack default, `use cache` existence,
dropping `output: "export"`) are all **verified correct**, and the flagship
architectural bet (server-rendered scoped `<style>` from an RSC for flash-free
theming) is genuinely sound for _this_ use case and does **not** need the
inline-script hydration dance. The real exposure is concentrated in one spot: the
**per-route font preload optimization (§5)**, a build-time static-analysis feature
that a **runtime** `fontKey→face` resolution likely defeats. A secondary soft spot
is loose RSC/code-splitting framing in §4.2.

### Findings

**① MAJOR — §5 / §6: runtime `fontKey` resolution likely defeats per-route font preload**

- _Claim:_ "a project's pages preload only the _rendered_ project's face"; "Preload
  is route-scoped by placement."
- _Verified against_ `03-api-reference/02-components/font.md` (Preloading + "Using
  Multiple Fonts"):
  - **"Declaration ≠ download" — VERIFIED CORRECT.** Calling the loader emits
    `@font-face` + a CSS var; a face the route never _applies_ costs no file fetch.
  - **Route-scoped _preload_ under runtime selection — UNVERIFIED / likely WRONG
    as stated.** `next/font` preload injection is a **build-time** transform keyed
    to which font object's `className`/`variable` a route _statically_ references.
    The roster resolves `fontKey` (a Sanity string) → face **at runtime**, so Next
    can't statically prove which face `/work/<slug>` renders. The per-route
    `<link rel="preload">` scoping probably collapses to "preload every roster face
    the module references" or "preload none" — not "only the resolved one."
- _Recommendation:_ Don't assume automatic per-route preload. Set `preload: false`
  on the roster by default and explicitly preload the resolved face, or accept
  preload won't be route-scoped. **Inspect the emitted `<head>` on a real project
  route before treating this as solved.**

**② MAJOR(-MINOR) — §4.2: RSC code-splitting framing is imprecise**

- _Verified against_ `02-guides/lazy-loading.md`: "By default, **Server Components
  are automatically code split**… Lazy loading applies to **Client Components**,"
  plus "When a Server Component dynamically imports a Client Component, automatic
  code splitting is currently **not** supported."
- _Correction:_ If project modules are Server Components, they're _already_
  auto-split and streamed — the manual `import()` buys conditional inclusion, not a
  client-bundle win. The real client savings come from the **Client Components
  inside** each module, where `next/dynamic`/`React.lazy` is the tool. Each
  registry value must be a **literal** `() => import("@/projects/log-explorer")` —
  a templated `import(\`…/${slug}\`)` defeats bundler static analysis/preload.

**③ VERIFIED CORRECT (+ bonus gotcha) — §7: `proxy.ts` replaces `middleware.ts`**

- _Verified against_ `01-getting-started/16-proxy.md` and `version-16.md`.
- _Addition:_ `proxy` runs the Node.js runtime only — the `edge` runtime is **NOT
  supported** in `proxy` and is not configurable. Any future edge-runtime
  interception would require _keeping_ `middleware.ts`.

**④ VERIFIED CORRECT — §7: Turbopack default & async Request APIs**

- Turbopack by default — confirmed; scripts correctly omit `--turbopack`.
- Async Request APIs: synchronous access fully removed in 16 — `cookies`,
  `headers`, `draftMode`, **and `params`/`searchParams`** are async. §6 TypeGen
  plan should lean on `PageProps`/`LayoutProps`/`RouteContext` helpers.

**⑤ MINOR — §7: `use cache` understated as a casual opt-in**

- _Verified against_ `01-directives/use-cache.md` + `version-16.md`: `use cache` is
  a **Cache Components** feature requiring `cacheComponents: true` — and in v16 that
  same flag is how you opt into PPR. Enabling it shifts the rendering model
  (dynamic APIs behind Suspense or passed as args; draft mode forces cached fns to
  re-execute). On serverless (Vercel), in-memory entries "typically don't persist
  across requests" — durable caching needs `use cache: remote`. Treat Cache
  Components as a deliberate decision, not a casual reach.

**⑥ VERIFIED CORRECT (credit) — §3.2/§6: server-rendered scoped `<style>` is legitimately flash-free**

- `02-guides/preventing-flash-before-hydration.md` is about **client-only state**
  (localStorage theme). Here `brandColor` comes from Sanity and is fully known on
  the **server**, so the `<style>` is in the initial HTML, server/client RSC
  payloads agree, and there's **no hydration mismatch and no FOUC** — exactly as
  claimed.
- _Minor caveats:_ emit via `dangerouslySetInnerHTML`; React 19 dedups
  `<style>`/`<link>` carrying `href`+`precedence`; if `ProjectScope` sits deep in a
  **streamed** subtree, ensure its `<style>` flushes before its themed children
  paint.

**⑦ VERIFIED CORRECT (credit) — §3.2: isomorphic OKLCH engine across server+client**

- A pure module with **no** `'use client'`/`'use server'` directive imports
  cleanly into both a Server Component and a Client Component — no RSC boundary
  gotcha. Keep the color math free of Node built-ins.

**⑧ NIT — §3.1/§6: `@layer` cascade & import-order discipline are well-judged**

- `01-getting-started/11-css.md` warns CSS-module/global ordering follows _import
  order_. Using `@layer foundation < brand < project` to neutralize insertion-order
  accidents is the correct framework-neutral tool.

### Strongest framework assumption to challenge

**That `next/font`'s route-scoped per-face preload survives a _runtime_
`fontKey→face` lookup (§5).** "Declaration ≠ download" holds; "only the rendered
face is _preloaded_ per route" is the part that I could not confirm and expect to
break. Needs an empirical `<head>` check before Phase 4 banks CWV on it.

### What the plan gets right about the framework

- proxy.ts rename, async Request APIs, Turbopack-default — all correct for 16.2.9.
- Dropping `output: "export"`, `force-static`, `trailingSlash` for Vercel SSR/RSC.
- Server-rendered scoped `<style>` for theming is genuinely flash-free without
  hydration hacks.
- Isomorphic pure-module engine shared across the server/client boundary.
- "Declaration ≠ download" for a large font roster.
- CSS-vars-only + `@layer` cascade is a sound, framework-aligned baseline.

_Doc paths cited:_ `01-app/01-getting-started/{13-fonts,16-proxy,11-css}.md`,
`01-app/03-api-reference/02-components/font.md`,
`01-app/03-api-reference/01-directives/use-cache.md`,
`01-app/02-guides/{lazy-loading,preventing-flash-before-hydration}.md`,
`01-app/02-guides/upgrading/version-16.md`.

---

## Theming — OKLCH engine, token scoping, cascade, fonts

### Verdict

The island model — per-project _complete_ token sets, no global themeable values,
`@layer` to escape CSS-Module insertion order, server-rendered inline scoped
`<style>` for color — is architecturally sound and well-reasoned. But the
load-bearing claim, **"one `brandColor` → full token set,"** is badly
underspecified: it treats the genuinely hard parts of a color system (perceptual
_contrast solving_, dark mode, semantic signal colors, interaction states, gamut
mapping) as free output of a lightness ramp, when each is a separate problem.
Secondarily, "flash-free" is true for color but conflates color with fonts
(FOUT-by-design), and the `@layer` plan hides a silent footgun (unlayered CSS
Modules beat everything) the docs never flag.

### Findings

**F1 — CRITICAL — Contrast must be _solved_, not _stepped_ — §3.2.** The engine
exposes "ramp, chroma/lightness steps, contrast values," implying text/on-brand
colors come from fixed lightness offsets. OKLCH L is perceptual lightness, **not**
WCAG relative luminance nor APCA Lc. A fixed ΔL yields wildly different contrast
ratios across hues/chromas — a palette that passes for a blue brand fails for
yellow/cyan at the _same_ steps. You can't step to a guarantee; you must solve for
the L that hits a target against a given background. _Rec:_ engine takes a contrast
target (APCA Lc for text, WCAG 2.x as compliance fallback), binary-searches L for
on-brand/on-surface pairs, and verifies against the **gamut-mapped** color (F5).
Single most important under-spec.

**F2 — MAJOR — Dark mode entirely unaddressed — §3.2, §6.** Signature is
`brandColor → tokenSet` (one set); no `prefers-color-scheme` story. In OKLCH dark
mode isn't "invert L" — you reduce chroma, shift surface L, re-solve on-color
contrast. Likely required for a digital garden. _Rec:_ commit to light-only
explicitly, or make the engine scheme-aware (`(brandColor, scheme) → tokenSet`) and
emit both into the scoped block via `light-dark()` (baseline 2025). This changes
the engine's core signature — decide now, not in Phase 4.

**F3 — MAJOR — Semantic colors aren't derivable from a brand hue — §3.2.**
success/error/warning/info are culturally fixed signal colors; you can't rotate the
brand hue to get them (a red brand would generate a red "success"). "One brandColor
→ full token set" is categorically insufficient here. _Rec:_ seed semantics
independently (small fixed set, contrast-solved per island background), or declare
them coordination-with-look.

**F4 — MAJOR — Unlayered CSS Modules silently beat all layered styles — §3.1.**
`@layer foundation < brand < project` correctly defeats specificity _for styles
inside layers_. But Next.js does **not** auto-assign CSS Modules to layers — a
module is unlayered unless it wraps itself in `@layer project {…}`, and unlayered
author styles outrank every layered style. One forgotten wrapper and that module
wins over the whole system. _Rec:_ lint-enforce "every CSS Module declares its
layer"; ensure the engine's scoped `<style>` declares `@layer brand`; declare the
bare order statement `@layer foundation, brand, project;` in a global sheet loaded
first.

**F5 — MAJOR — Wide-gamut OKLCH with no gamut-mapping plan — §3.2.** OKLCH chroma
valid in the model routinely exceeds sRGB and even Display-P3; the docs never
mention clamping. Naive browser clamping shifts hue and flattens chroma, so (a) the
palette won't render as designed on sRGB, and (b) emit-time contrast math is
computed against a color the screen never shows. _Rec:_ gamut-map (cusp-aware,
Ottosson-style chroma reduction) _before_ computing contrast; pick P3-vs-sRGB
target explicitly.

**F6 — MAJOR — "Flash-free" conflates color with fonts — §3.2, §5, §6.** Color
_is_ flash-free (inline SSR custom props arrive with markup). But `font-display:
swap` is FOUT by design, and since only above-the-fold faces preload, every
per-project display face visibly swaps on navigation to `/work/<slug>`. _Rec:_
reword to "flash-free _theming_, zero-CLS fonts with an intentional swap"; decide
`swap` vs `optional` per face.

**F7 — MAJOR — Streaming/Suspense placement of the scoped `<style>` — §3.2, §7.**
Flash-freedom requires the scoped `<style>` to flush in the **same chunk as, and
before,** its styled subtree. If a `ProjectScope` sits inside a Suspense boundary,
naive placement can let surrounding content paint first; a raw inline `<style>`
also won't dedupe across repeated islands. _Rec:_ use React's `<style href
precedence>` hoisting; validate with multiple islands on one page.

**F8 — MAJOR — focus-ring _color_ is a look hiding in the coordination bucket — §3.1.**
Geometry (width, offset, style, `:focus-visible` policy) is coordination — correct.
But focus-ring _color_ is a look: a fixed neutral ring may fail contrast against a
dark-brand island background. Audit the global _reset_ for the same smuggling —
`::selection`, `accent-color`, default link color are all looks. _Rec:_ split
focus-ring geometry (`:root`) from color (island scope, contrast-solved); move
`::selection`/`accent-color` out of the global reset.

**F9 — MAJOR — Per-token downward override vs. baked literals — §1, §3.3.** §1/§3.3
claim `var(--public, var(--_internal-default))` "generalizes from leaf primitives to
the whole system." It doesn't, cleanly: if the engine bakes literal `oklch()` values
server-side, overriding `--logx-accent` at runtime will **not** cascade to
`--logx-accent-hover` (hover was computed once from the original seed). Live
per-token override requires emitting **relative color** (`oklch(from
var(--logx-accent) …)`) — but that moves color into the browser, where you cannot
contrast-solve (F1) or gamut-map (F5) at emit time. Pick a lane and state it. (This
is my strongest-assumption pick.)

**F10 — MINOR/MAJOR — next/font roster barrel may over-preload — §5.** next/font
preloads based on the font being referenced in a route's module graph, not where
the class is applied. Centralizing all faces in one `roster.ts` imported by the
shared `ProjectScope` (rendered on every route) risks preloading _all_ faces.
_Rec:_ set `preload: false` on all project faces, preload only the 1–2 shell faces,
apply non-preloaded faces via their `.variable` class; verify in build output.

**F11 — MINOR — Breakpoint custom props can't drive `@media` — §3.1.** CSS variables
are invalid inside media-query conditions (`@media (min-width: var(--bp))` does
nothing). _Rec:_ use container queries / `@custom-media` (build-time) or keep
breakpoints as build constants.

### Strongest theming assumption to challenge

**"The OKLCH engine can be a pure `brandColor → tokenSet` server function, _and_ the
system supports downward per-token override, _and_ it guarantees contrast — all
three."** You get at most two. Baking literals server-side buys contrast-solving +
gamut mapping but kills live CSS override of derived tokens. Emitting relative-color
CSS buys live override + a smaller `<style>` payload but surrenders contrast/gamut
guarantees to the browser. The plan asserts all three without noticing the tension.
Forcing this decision is the highest-leverage thing the debate round can do.

### What's genuinely well-reasoned

- Per-island complete token sets / "no global themeable values" — correctly avoids
  the "global theme + overrides" trap.
- `@layer` to escape CSS-Module insertion order — right tool, right reason (needs
  the unlayered guard, F4).
- Server-rendered inline scoped `<style>` for color — genuinely flash-free for
  color.
- Previews-are-not-islands — pragmatic; `--c-*` vs `--logx-*` separation pre-empts
  collisions.
- Pure, isomorphic, dependency-free engine, one source / three consumers — clean
  dependency direction.
- Roster-by-key fonts — preserves next/font optimizations.

---

## ContentModel — Sanity schema, reference-by-key, GROQ/TypeGen, draft mode

### Verdict

The content model is unusually well-reasoned for a portfolio: the reference-by-key
pattern is applied consistently, the essay-free `/work` query is correct, and the
`keys.ts`/resolver split is sound _in principle_. But the plan has a load-bearing
blind spot: **reference-by-key has zero referential integrity, and the plan never
specifies what happens when a Sanity key points at code that no longer exists.**
That single gap — plus an under-modeled draft-mode/visual-editing story for in-essay
live embeds — is where CMS and code will silently drift.

### Findings

**[CRITICAL] Key-drift has no fallback or validation story — §6, §4.2.** Keys are
plain strings in Sanity with no referential integrity to code. The
dropdown-from-`keys.ts` only protects _authoring time on the current deploy_.
Already-saved docs are unprotected against: (a) a component/font/widget renamed or
deleted in code, (b) a doc authored against a newer Studio deploy than the running
app, (c) draft docs holding a key removed before publish. Nothing says what the
resolvers return for an unknown key. The default behavior of an unguarded map lookup
is `undefined` → render-time crash, and for a _whole-project_ `componentKey` miss
that's a dead `/work/<slug>`. _Recommend:_ (1) every resolver returns a typed
result, not a bare lookup. (2) Render a visible fallback. (3) Add a CI check that
reads all _published_ key values from Sanity and asserts each exists in code. (4)
Treat key renames as Sanity content migrations.

**[MAJOR] `keys.ts`/resolver split: rationale is half-right, and the split is a real
sync burden — §6, §4.2.** Keeping `next/font` and lazy `import()` bundles out of the
Studio bundle is _legitimate_. But (a) it's **two files that must stay in sync by
hand** — add a key, forget the resolver, and you've manufactured the orphaned-key
crash at authoring time; (b) the plan should state `keys.ts` is the **single source
of truth** and resolvers are typed `Record<ComponentKey, …>` so a missing entry is a
compile error.

**[MAJOR] "One block type per widget" does not scale — §6.** Making _every_
embeddable widget its own Portable Text block type means each new widget = a new
schema type + a new `of:[]` entry + a new serializer case + TypeGen regen + Studio
redeploy. There's also tension _within_ the plan: §6 says `liveEmbed` = `embedKey` +
caption (a single generic block), but also says model inputs as explicit fields per
widget. _Recommend:_ keep `liveEmbed` as the default for prop-less live components;
reserve dedicated typed blocks for the _few_ widgets that need authored inputs.

**[MAJOR] `brandColor` type & validation is unspecified — the OKLCH engine will
receive garbage — §6, §3.2.** Its type is never stated, and there's no validation
that it's parseable or in-gamut. An editor can type `#ggg`, `rebeccapurpl`, an empty
string, or an out-of-sRGB color. The engine "knows nothing about projects" — a bad
input either throws during SSR (500) or silently emits a broken palette.
_Recommend:_ (1) pick a concrete type (validated string or `@sanity/color-input`);
(2) Sanity custom validation parsing with the _same_ color lib the engine uses; (3)
`ProjectScope` falls back to a default brand if the engine throws.

**[MAJOR] Visual editing / Presentation overlays vs. in-essay live embeds & scoped
islands — §7, §3.1.** (a) Presentation click-to-edit relies on `data-sanity` stega
encoding injected into strings; **stega-encoded invisible chars in `brandColor` or
`fontKey` will break the OKLCH parse and the font-class lookup** unless stega is
disabled for those fields. (b) A `liveEmbed` that mounts an _interactive component_
is a region Presentation can't meaningfully map to editable content. (c) z-index
coordination needs to account for the Presentation overlay layer too. _Recommend:_
decide per-field stega behavior explicitly; treat `liveEmbed` click-to-edit as
caption-only; test the experience-surface reset inside the Presentation iframe early.

**[MINOR] `references()` for backlinks: right tool, but under-specified — §6.**
`*[references($id)]` is the correct Sanity primitive and the standard digital-garden
approach — good call. But backlinks are **one-directional queries**, not stored
bidirectional edges — the _forward_ links must exist as actual reference fields (or
PT reference marks) for `references()` to find anything. If notes link via free-text
slugs that aren't true references, `references()` returns nothing. For notes, **use
real `reference` fields** — integrity for free.

**[MINOR] TypeGen + `defineQuery` — realistic, with known sharp edges — §6, §7.**
(a) TypeGen only re-runs when _invoked_ — needs a committed script + ideally a CI
check that `git diff --exit-code`s the generated types. (b) `defineQuery` must wrap
the query literally (no runtime interpolation). (c) Portable Text + per-widget embed
blocks generate large union types. (d) Projections that drop fields produce
_different_ generated types — name the queries to make that legible.

**[NIT] `cardSwatches` / essay-free `/work` query — sound, minor note — §6, §3.2.**
Correct and good for CWV. `cardSwatches` runs the engine per card at request time —
if `/work` uses `use cache`/ISR, ensure the swatch computation is inside the cached
render. Also it's a _fourth_ consumer of `brandColor` that will choke on the same
invalid-color input — centralize the parse/validate.

### Strongest content-model assumption to challenge

**"The dropdown-generated-from-`keys.ts` makes the reference-by-key contract safe."**
It only makes _new authoring on the current deploy_ safe. The entire population of
already-saved documents, drafts, and docs authored against a different deploy version
have no protection — and a CMS's whole value is that content outlives any given code
state. Reference-by-key is fundamentally a _soft_ foreign key with no database
enforcing it; the plan needs to own that and build the validation/fallback/migration
layer that a real foreign key would give you for free.

### What's genuinely well-modeled

- The reference-by-key _pattern_ applied uniformly across
  `componentKey`/`fontKey`/`brandColor`/`embedKey`.
- Essay-free `/work` query enforcing "a few colors per card" _at the data layer_.
- The `keys.ts`/resolver split's core rationale is real (just needs the CI safety
  net).
- `ProjectScope` as a single resolution keystone.
- Lazy-import per module keyed off `componentKey`.
- `references()` for backlinks (just needs forward-link modeling pinned down).

---

## Sequencing — build order, critical path, exit criteria, deferral, risk

### Verdict

The phasing is thoughtful and its organizing principle — "drive everything toward
one flash-free themed project through `ProjectScope`, then go wide" — is the right
keystone-first north star. But the critical path inverts normal risk-retirement: it
builds the **hardest, most speculative subsystem (OKLCH engine) first**, only proves
it end-to-end in Phase 3, and defers the **one migration the rearchitecture exists
for (`log-explorer`) to dead last**. With no walking skeleton, a first slice coupled
to the engine it's meant to validate, and testing/error-states/CI entirely
unscheduled, the architecture risks being tuned to the easy case and discovering
gaps far too late.

### Findings

**F1 — MAJOR — No walking skeleton; integration risk back-loaded — Critical path /
Phases 1–3.** First end-to-end render through a route is Phase 3. Phases 1–2 build
sophisticated subsystems never integration-tested against a real request until late.
If `ProjectScope`'s flash-free `<style>` has a problem (hydration mismatch, RSC
streaming + style ordering, `@layer` vs Next style injection), you learn it after
three phases of investment. _Rec:_ Insert **Phase 0.5 walking skeleton** — one
hardcoded project + a _stub_ `ProjectScope` emitting a hand-written `<style>` (no
engine), rendering at a thin route on Vercel.

**F2 — MAJOR — Hardest + most speculative piece first — Phase 1.** Its exit criterion
("runs identically on server and client") says nothing about _output quality_ — you
can "pass" Phase 1 with unusable palettes and not learn it until Phase 3. _Rec:_
reframe the exit around **observable output**: a visual harness rendering ramps for
3–4 representative brand colors with contrast assertions.

**F3 — MAJOR — `log-explorer` migration deferred to last is the riskiest call —
Phase 4.** The architecture's stated reason to exist is validated only in Phase 4,
after the model is frozen against `oklch-engine`, a greenfield engine-friendly toy.
Textbook "tune to the easy case." _Rec:_ Pull a **thin slice of real log-explorer
forward** — at minimum a Phase-2 spike mapping its actual surface onto the module
structure + content model.

**F4 — MAJOR — First vertical slice couples to the hardest subsystem — Phase 3.**
Phase 3 picks `oklch-engine` as the first project — its experience is a playground
for the Phase 1 engine. No _code_ circular dependency, but a **validation
circularity**: if the engine is wrong, theming and the showcased experience fail
together and you can't tell which layer broke. _Rec:_ Make the first slice a
**dead-simple throwaway project** to exercise routing + `ProjectScope` + Sanity +
RSS + draft mode in isolation; build `oklch-engine` as the _second_ slice.

**F5 — MAJOR — Testing entirely unscheduled despite Vitest already in the repo — all
phases.** Vitest + RTL are set up (commit `3401f2d`) and the author's standards
mandate testing core logic early + ≥1 integration test. Yet no phase mentions a
single test. _Rec:_ engine unit + isomorphism tests **in Phase 1** as the exit
criterion's evidence; resolver/`cardSwatches`/index-query tests in Phase 2; one
integration/E2E of the Phase 3 primary flow.

**F6 — MAJOR — Whole cross-cutting concerns unscheduled — all phases.** Never
scheduled: **error/empty/loading/not-found states**; **SEO/metadata**
(`generateMetadata`, OG); **accessibility** (the engine _generates contrast values_);
**CI** (lint/format/test gate); **analytics**. _Rec:_ not-found/error path in Phase 3;
`generateMetadata` per route in Phase 3; contrast/a11y assertions folded into Phase 1;
a CI workflow as a **Phase 0** task.

**F7 — MAJOR — Lint boundaries deferred to Phase 4 will let violations rot — Phase 4 /
Deferred.** Boundaries are load-bearing architecture, not hardening. Unenforced until
Phase 4, three phases of code get written without a guardrail. _Rec:_ Move
`eslint-plugin-boundaries`/`no-restricted-imports` to **Phase 0**.

**F8 — MINOR — Parallelism claim (Phase 2 ∥ Phase 1) hides a serialization point —
Phase 2.** `cardSwatches(brandColor)` _runs the engine_ (blocked on Phase 1) and the
resolvers depend on `keys.ts`. _Rec:_ annotate each Phase 2 task with its true gate.

**F9 — MINOR — Several Phase-3 line items are multi-commit — Phase 3.** "Theme the
shell island … build home, about, `/now`" is 3–4 pages; "Add an RSS route handler;
enable draft mode" joins two unrelated features; "Build `oklch-engine`" is an entire
module. _Rec:_ pre-split heavy bullets so the task list _is_ the commit list.

**F10 — MINOR — Only end-to-end exit criterion before Phase 3 is "app deploys" — Exit
criteria.** No "a request renders a themed scope" checkpoint until Phase 3. _Rec:_ if
F1's skeleton is adopted, its exit criterion supplies the missing early integration
checkpoint.

### Strongest sequencing assumption to challenge

**"Build the dependency root (the engine) first because everything hangs off it."**
This conflates _code-dependency order_ with _risk-retirement order_. Topologically the
engine is the root — but good sequencing retires the **highest-uncertainty integration
risk** first, which here is _not_ the color math (a pure function you can get right in
isolation) — it's whether Next 16 / React 19 / RSC will server-render a per-scope
`<style>` block flash-free and hydrate cleanly on Vercel. A walking skeleton with a
stub scope tests the scary part first and makes the engine a low-risk swap-in.

### What's genuinely well-sequenced

- The organizing principle is correct (keystone-first).
- Deferred-by-design discipline is mostly excellent (textbook YAGNI).
- Phase 0 is properly dependency-free and parallelizable.
- Exit criteria mostly exist and are mostly concrete.
- Reference-by-key content model is consistently threaded.
- Self-validating engine showcase is elegant (only quarrel is using it as the
  _first_ slice).

**Two riskiest calls:** (1) hardest+most-speculative-first with no walking skeleton,
and (2) deferring the raison-d'être migration to last while freezing the model against
a greenfield toy. Both share one root cause: **sequencing by code-dependency topology
instead of by risk retirement.**
