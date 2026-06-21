# Portfolio & Digital Garden — Architecture Plan

A high-level, best-practices plan for a Next.js portfolio that doubles as a digital
garden. Each project is a **self-contained module** — its pages (always the interactive
experience, plus whatever else it needs: an essay, a hero, rich media), the components its essay
embeds, and its tokens — composed together within the site. Hosted on Vercel. Essay + brand
seeds in Sanity.

This is a planning reference, not a prescription — it captures the model and the
decisions made, with the reasoning.

> **Revised 2026-06-21** to incorporate the architecture audit. References like `[D3]`
> point to `docs/decisions.md`; the audit reasoning lives in `docs/audit/`. Where this
> plan and the decisions log ever disagree, the decisions log wins.

> Project slugs (e.g. `log-explorer`) and token prefixes (e.g. `--logx-*`) below are
> placeholders.

---

## 1. Guiding principles

These are the through-lines; everything else follows from them.

- **Modules, not a monolith.** The thing to avoid is a single fused bundle with no internal
  seams (the old log-explorer). Each project is a self-contained module — its tokens, UI,
  pages, and interactive experience — that the site's routes load. Genuinely shared parts
  (token recipes, the OKLCH engine, the odd reused primitive) live in plain shared modules.
  No fused bundle; no premature abstraction either.

- **Composition over inheritance.** Each project (and the site shell itself) is an
  independent _themed island_ with its own **brand color and font**, composed on top of a
  shared invariant foundation. Projects are not variations of one global _brand_; they are
  self-assembled from shared parts. "Shared" is a build-time authoring convenience for the
  invariant tier and a runtime parent only for genuinely invariant plumbing `[D1]`.

- **Self-sufficient contracts; theme downward; never reach up _for a look_.** Every unit — a
  token group, a component, a project module — ships its own defaults and is themed by
  whatever composes it _downward_. Nothing depends on **themeable** ambient context (a brand
  or feel value) provided by an ancestor it doesn't own. It _may_ depend on the global
  **invariant** layer (spacing, motion, breakpoints, z-index, semantic colors) — that's
  shared plumbing, not a look. This is the precise form of "don't reach up the tree," and it
  generalizes the `var(--public-override, var(--_internal-default))` pattern from leaf
  primitives across the system — but as **composition-time** theming (a host sets the tokens
  a child reads), not runtime re-derivation of an engine's computed ramp `[D3]`.

- **Right-sized, not maximal.** This is one app with a handful of projects, not a set of
  shippable packages. Keep the island model, downward theming, and the don't-reach-up
  discipline where they earn their keep. Relax the package-era purism: the foundation is
  shared globally and only **brand + font + feel** are scoped per island `[D1]`; a small
  invariant _coordination_ layer is the norm (§3.1), the embed registry starts single-tier
  (§4.1), and the litmus (§8) applies to shared primitives, not every component. Concentrate
  the sophistication where it pays — the OKLCH engine (it is the load-bearing, genuinely hard
  piece), the content model, performance — and let the rest be boringly simple.

---

## 2. Code vs content

Two homes:

- **The Next app** — all code: each project's pages, its interactive experience (a working
  demo), and the components its essay embeds. Each project is a self-contained module under
  `src/projects/<slug>/`; shared parts live in plain shared modules.
- **Sanity** — content & brand seeds: essay (rich text with embeds), notes, tags, per-project
  `brandColor`, `fontKey`, and the `componentKey` reference.

Within a project the division is code vs content, but the line isn't a wall. The interactive
experience and the components are code; the essay is content. The essay is _rich_, though — it can
embed media and live components (including the demo itself, in place of screenshots) by key —
per-project or shared, the same reference-by-key move as `componentKey` (§4.1–4.2, §6). There's
no demo-vs-experience split _inside_ the experience itself — its logic lives in a headless core
when it earns one (§4.3), but that's ordinary code organization, not a boundary the site has to
maintain.

The shell is itself an island (§3.1) with its own top-level pages — home, about, `/now` —
themed the same island way, but owned by the site rather than any project module.

---

## 3. Token & theming architecture

### 3.1 Three tiers: invariant (global), brand+font (engine-scoped), feel (scoped override) `[D1]`

What actually varies per project is **brand color, font, and the feel/geometry set** — not
spacing, type-scale ratios, motion, or breakpoints, which are house style. So the system is
three tiers, not "a complete self-described foundation per island":

| Tier                     | Lives at                                   | Contents                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invariant foundation** | global `:root`                             | spacing ramp, motion curves/durations, breakpoints, z-index scale, type-scale ratios, focus-ring **geometry**, the reset, **semantic colors** (success/error/warning/info)                  |
| **Brand + font**         | `[data-project]` scope, engine-driven      | the OKLCH color ramp (incl. focus-ring _color_) + the resolved font face — always scoped, always flash-free                                                                                 |
| **Feel / geometry**      | `[data-project]` scope, small override set | corner radius, border weight, shadow softness, density — defaults inherited from the invariant tier, overridden only where a project genuinely differs (e.g. a brutalist vs editorial look) |

A project's pages and the components they embed live in the same scope and read **one
per-project token namespace** — e.g. `--logx-*` for Log Explorer — for the brand/feel tier,
on top of the global invariant tier.

```
global :root  (the invariant tier — shared plumbing AND shared looks-that-don't-vary)
   ├─ spacing ramp · motion curves · breakpoints · z-index · type-scale ratios
   ├─ semantic colors (success/error/…) — fixed signal colors, NOT brand-derived [D8]
   ├─ focus-ring GEOMETRY · reset
   └─ @layer foundation, brand, project;   ← bare order statement, loaded first [D12]
          │ composed by ↓
[data-project="garden"]   ← the site shell is just another island (home, about, /now)
[data-project="log-explorer"]   each declares ONLY its brand + font + any feel overrides
   ├─ brand tokens   ◄── OKLCH engine ◄── this project's brandColor (from Sanity)
   ├─ font           ◄── resolved face's .variable class [D11]
   ├─ feel overrides (radius/border/shadow/density) — only where it differs
   └─ --logx-*       internal alias mapped from the generic --brand-* / --font-face [D2]
          │ themes downward ↓
   the project's pages + embeds   read var(--brand-*) / var(--font-face) / var(--space-*)
          └─ [data-experience-surface]  optional scoped reset for an interactive surface
```

Key points:

- **The public token contract is the GENERIC layer** `[D2]`. Shared, cross-project units
  read `--brand-*`, `--font-face`, and the global `--space-*`/invariant tokens — never a
  project-prefixed `--logx-*`, because a shared embed cannot know a project's prefix.
  `--logx-*` is a project-internal _alias_ mapped from the generic names; it exists for the
  project's own code, not as the contract.

- **No global _brand/feel_ values; invariant foundation IS global** `[D1]`. The rule is not
  "nothing themeable at `:root`" — it is "nothing that carries a project's _brand or feel_ at
  `:root`." Spacing/motion/breakpoints/type-ratios/semantics are themeable-in-principle but
  invariant-in-practice, so they live globally and a scope may _override_ a feel token via
  normal cascade (still downward theming). The brand ramp always lives in the scope, because
  it genuinely varies and must be flash-free per island.

- **Every CSS Module must declare its `@layer`** `[D12]`. Verified against the installed Next
  16 docs: Next does **not** auto-assign CSS Modules to a cascade layer, and an _unlayered_
  module's plain declarations outrank **every** `@layer` style regardless of specificity or
  source order. So any component CSS Module that sets real properties must wrap its body in
  `@layer project { … }` (or stay strictly var-_consuming_); the engine's scoped `<style>`
  declares `@layer brand`; the bare `@layer foundation, brand, project;` order statement is
  emitted in a global sheet loaded first. This is lint-enforced (§8, Phase 0).

- **Cascade order via `@layer`** (foundation < brand < project) to kill CSS-module
  insertion-order accidents instead of fighting specificity.

- **Breakpoints are not `:root` custom properties** `[D22]`. CSS variables are invalid inside
  `@media` conditions, so breakpoints are build-time constants / container queries; custom
  props can still feed JS.

### 3.2 The OKLCH engine

The engine is the load-bearing, genuinely hard piece of the system — not a lightness ramp but
a small color _system_. It is **both a feature and a project — same logic, two-plus
consumers.**

- A **pure function**: takes a brand color **and a scheme**, emits a color-token set. Knows
  nothing about projects. Lives in a shared module (e.g. `src/lib/oklch/`) — no React, no DOM,
  no Node built-ins — as the single source of truth for the algorithm. Its isomorphism is
  **enforced**, not hoped: a lint import-boundary on the folder forbids `next/*`, `react`,
  `react-dom`, and DOM/Node globals, and a dual-environment test runs the suite under both
  `node` and `jsdom`. (Do **not** use `server-only`/`client-only` — those pin it to one side
  and break the requirement.) `[D14]`

- **Scheme-aware from v1** `[D5]`. The signature is `(brandColor, scheme) → tokenSet`. One
  `brandColor` per project generates **both** light and dark ramps — dark is reduced chroma +
  shifted surface L with on-color contrast re-solved, not "invert L." The scoped `<style>`
  emits both via CSS `light-dark()` so a single block carries both schemes and switching is
  pure CSS, respecting `prefers-color-scheme`.

- **Contrast is solved, not stepped** `[D4]`. OKLCH `L` is perceptual lightness, _not_ WCAG
  relative luminance or APCA Lc — a fixed ΔL passes for a blue brand and fails for yellow/cyan
  at the same steps. The engine takes a contrast target (APCA Lc for text, WCAG 2.x as
  compliance fallback) and binary-searches `L` for on-brand/on-surface pairs against the
  relevant background.

- **Gamut-map before contrast math** `[D6]`. OKLCH chroma routinely exceeds sRGB and even P3;
  the engine cusp-maps (Ottosson-style chroma reduction toward the boundary) to the chosen
  target gamut (pick P3 vs sRGB explicitly) _before_ computing contrast, so the math is done
  against the color the screen actually shows.

- **Bakes literal `oklch()` values server-side** `[D3]`. The engine emits resolved, gamut-mapped,
  contrast-solved literals — not relative-color CSS. Live per-token CSS override is explicitly
  **not** a goal: no consumer needs the cascade to re-derive a mid-chain token (the playground
  and card swatches re-run the pure function in JS). Relative-color (`oklch(from …)`) is
  permitted only for decorative, non-contrast deltas (hairlines, subtle tints). This is also
  what makes server-side validation possible (below).

- **Focus-ring _color_ is an engine token** `[D7]`; only its geometry is global invariant.
  Audit the global reset for other smuggled looks (`::selection`, `accent-color`, default link
  color) and move them to the scoped tier.

- **Semantic colors are seeded independently** `[D8]`, in the invariant tier — they are fixed
  signal colors, not rotations of the brand hue. The engine does not derive them. (Build
  deferred until the first status-bearing UI; reserve the slot now.)

- **Defensive, never throws** `[D9]`. `brandColor` comes from an editor and may be invalid or
  out-of-gamut. The engine parses/clamps/gamut-validates and **returns a safe fallback palette**
  rather than throwing — a bad color is expected data, not an exceptional bug. This pairs with
  author-time Sanity validation (§6) and a `ProjectScope` backstop (§6, §7).

- Runs **per scope** — once per project (seeded by that project's `brandColor`) and once for
  the shell. Multiple themed islands can coexist on one page. **Previews are not islands**: a
  `/work` card or note preview needs a few colours, not a namespace, so it derives them from
  the same engine (Consumer C) and skips the scoped `<style>` block.

- Emitted as a **server-rendered scoped `<style>` block** (`[data-project="x"] { … }`),
  declared `@layer brand`. On Vercel this is genuinely **flash-free for color** — verified: the
  `brandColor` is known on the _server_, so the `<style>` is in the initial HTML, server/client
  RSC payloads agree, and there's no hydration mismatch and no FOUC (no inline-script hydration
  hack needed). Emit via `dangerouslySetInnerHTML`. If `ProjectScope` can ever be _suspended_,
  use React 19 `<style href={`theme-${slug}`} precedence>` so the boundary blocks on it before
  paint; if it renders in the shell above any Suspense (the common case), plain inline is
  already flush-before-paint. `[D13]`

- The **mapping** of generated brand tokens into the project namespace
  (`--logx-accent: var(--brand-accent)`) lives in the project scope, not in the engine.

**Three consumers, one engine:**

- **Consumer A — the theming feature**: the per-scope theming layer calls the engine on the
  server to emit each island's `<style>` block.
- **Consumer B — the portfolio piece**: `src/projects/oklch-engine/` is an ordinary project
  module (§4) whose interactive experience is a playground (drag a hue, watch the palette
  regenerate). The experience **imports the same shared engine** — it never reimplements it,
  and it re-runs the pure function in JS on each slider move (it does not rely on CSS
  re-derivation).
- **Consumer C — preview swatches**: the `/work` index (and note previews) call a
  `cardSwatches(brandColor)` helper that runs the **same engine** and returns just a few stops.
  The card sets them as inline `--c-*` custom properties and uses the shell font — no island,
  no `<style>` block, no full namespace. It runs the whole engine and emits only a few stops
  (the lightness is in payload/DOM, not compute), and it goes through the same parse/validate
  path as everything else.

Two deliberate consequences:

- **It themes itself, on purpose.** The oklch-engine project is a themed island like any
  other, so its own brand tokens are generated by the engine it showcases. No circular
  dependency in code (the project depends on the engine; the engine depends on nothing).
- **Keep it isomorphic** (enforced — see above).

The anti-pattern to avoid: putting the engine _inside_ the project module and having the
theming layer reach up into a portfolio piece for infrastructure — that inverts the dependency
direction. Shared logic lives in a shared module; the project is a presentation of it.

### 3.3 Downward theming

The **project scope is the single downward-theming owner** for brand + feel: it declares the
project's brand tokens (from the OKLCH engine) plus any feel overrides, and themes everything
beneath it — every page and every embedded component — by passing those values _down_. They
all read the same scoped tokens; the project scope is the authority. The invariant tier sits
above, shared.

The directional rule:

- **Host themes the child downward** by setting the tokens the child consumes. Fine.
- **Child reaching up** for an ancestor's _themeable_ (brand/feel) value. Banned.
- **Reading the global _invariant_ tier** (spacing, motion, semantics). Allowed — it's shared
  plumbing, not a look `[D1]`.

The override surface is precise `[D3]`: you override the **seed** (re-run the engine,
server-side, per scope) **or** a **leaf consumable token** (`--brand-accent`, `--font-face` —
a literal a host sets and a component reads). You never override a _mid-chain derived_ token
and expect its derivatives to recompute — the engine baked them. The
`var(--public, var(--_internal-default))` pattern is for composition-time downward theming of
primitives, not live ramp re-derivation.

Self-sufficiency still applies _within_ the island: a shared primitive must not assume tokens
from any _specific_ project's scope. It ships its own defaults and reads generic names
(`--brand-*`, `--font-face`), so it works composed into any project (or none).

---

## 4. Project modules

### 4.1 Structure

```
src/projects/<slug>/
  ├─ pages/             the project's own page components — essay / hero / other
  ├─ experience.tsx     the interactive experience (the working demo); a thin page mounts it [D20]
  ├─ core/              headless core — ONLY when the experience's logic earns extraction [D20]
  ├─ embeds.ts          project-local embed map (key → component) — bespoke inline embeds
  ├─ tokens.css         the project's scoped brand + feel (--logx-* mapped from --brand-*)
  └─ index.ts           registry entry
src/fonts/roster.ts        curated next/font declarations, one per face, exported by key
src/embeds/registry.ts     shared embed map (key → component) — cross-project widgets
src/projects/registry.ts   componentKey → () => import("@/projects/<slug>")   [literal imports, D21]
src/*/keys.ts              string-constant key contracts (Studio imports these; resolvers don't) [D10]
```

A project is **one or more pages**. The interactive experience is the only constant; beyond it
a project may have an essay/rich-media page, a hero, something else, or nothing more at all —
the page set is decided per project, not fixed by a template. `experience.tsx` is the
component; a thin page in `pages/` mounts it `[D20]`. A headless `core/` is **not** templated
into every module — let it emerge only when an experience's logic warrants extraction (same
deferral discipline as the embed tiers) `[D20, §4.3]`. The module owns its page components;
thin route files mount them. Code lives under `src/projects/<slug>/`; **routes live under
`/work`** — `/work` is the index of project cards, `/work/<slug>` mounts a project's pages.

**Phase it: start single-tier** — one shared `src/embeds/registry.ts` until a second project
actually reuses a widget; introduce the project-local tier only then. Once you do, embeds
follow the **same per-project-plus-shared shape as tokens and fonts**. For a given project the
resolver composes the two (`{ ...shared, ...projectLocal }`) so a project-local key
**overrides** a shared one of the same name — the downward-override spirit of
`var(--public-override, var(--_internal-default))`. A _shared_ embed themes off the **generic**
tokens (`--brand-*`, `--font-face`), never a project-prefixed alias `[D2]`. Promote a widget
into the shared registry only once it's genuinely reused; both tiers lazy-import.

Most UI belongs to its project module; lift a primitive into a shared `src/` module only once
it's genuinely reused across projects — not preemptively. A project may also _consume_ shared
logic without owning it — the oklch-engine project's experience imports the shared engine
rather than holding it (§3.2).

### 4.2 The CMS ↔ code registry

```
Sanity project doc { componentKey: "log-explorer", brandColor, fontKey, copy, notes, tags }
        │
        ▼
src/projects/registry.ts   "log-explorer" → lazy import of the project module
        │
        ▼
src/projects/log-explorer/   its pages (experience + any essay/hero/other) + embeddable components
```

- **Content references; code resolves.** The essay comes from Sanity and references coded
  components by key, resolved against the project-local `embeds.ts` first, then the shared
  `src/embeds/registry.ts`. The CMS never reimplements interaction.
- **Keys are a contract with no referential integrity — guard the seam** `[D10]`. `keys.ts`
  is the **single source of truth** for which keys exist; resolvers are typed
  `satisfies Record<Key, …>` so a missing resolver entry is a **compile error** (converts
  code→code drift from a runtime crash into a build break). Resolvers return a typed
  `NotFound`, never a bare `map[key]` lookup, so the content→code direction (a saved Sanity
  key whose code was renamed/deleted) degrades to a visible fallback instead of crashing —
  `not-found.tsx` for a `componentKey`/slug miss, a "missing embed" placeholder in the
  Portable Text serializer for an `embedKey` miss. (A CI check that GROQs all _published_
  keys and asserts each exists in code is deferred to Phase 4 — it's an additive safety net,
  not a schema decision.)
- **Lazy-load each module** via a **literal** dynamic import per key
  (`() => import("@/projects/log-explorer")`, never a templated `import(\`…/${slug}\`)`, which
defeats bundler static analysis) `[D21]`. Server Components are auto-split already; the
  manual lazy import buys conditional inclusion, and the real client-bundle savings come from
  the Client Components _inside_ each module.

### 4.3 The interactive experience: logic in a headless core (when it earns one)

Each project's interactive experience is a demo that actually works. As a general engineering
practice — not for any packaging or reuse goal — its logic _can_ live in a **headless core**
(hooks / pure functions — state machines, reducers, derivations), with presentation as
separate primitives the experience composes. That split is internal hygiene only, and it is
**not mandatory**: a toggle/slider demo doesn't need a state machine in a separate folder.
Extract a `core/` when the logic warrants it `[D20]`.

There's no demo-vs-experience boundary to maintain. The experience owns its own state and
renders directly. The same interactive experience — or smaller bespoke live components — can
be **embedded inline in an essay** by key, in place of screenshots (§6), under the same
project scope, so it themes identically.

---

## 5. Fonts

**Decision: store-the-key (roster-by-key).** A curated roster of faces is declared in code
(each a `next/font` export, in a single shared module); Sanity stores a `fontKey` per project
and the editor picks from a dropdown; the project scope applies the face that key resolves to,
via that face's **`.variable` class** on the `[data-project]` wrapper, with `--logx-font`
mapping to it `[D11]`. This keeps `next/font`'s self-hosting, subsetting, and zero-CLS sizing
while putting a project's type choice on its document alongside its brand color.

`next/font` must be called at module scope, so the roster can't be _arbitrary_: an editor
picks from the curated set, never a free-text name or upload. **Adding a face to the roster is
a code change; choosing among existing faces is content.**

Two facts make a large roster cheap:

1. **Declaration ≠ download.** Calling `next/font` emits an `@font-face` + a CSS variable; the
   browser only fetches a font file when rendered text uses that family. Declaring fifty fonts
   costs zero downloads on a page that uses none of them. (Verified against the installed
   docs.)
2. **Preload is build-time static analysis — and our `fontKey` is a runtime index** `[D11]`.
   `next/font` injects `<link rel=preload>` for a face it can _statically_ see a route
   reference. Because the roster resolves `fontKey` (a Sanity string) → face at **runtime**,
   Next cannot target the resolved per-project face for preload. This is **not** an SSG-vs-
   dynamic question (that route-level toggle is gone under Next 16 `cacheComponents`, §7) —
   it's a build-time-static-analyzability question, independent of caching.

So, the policy:

- **`preload: false` on every roster face** by default (the default is `true`, so this must be
  set explicitly). Only the **1–2 shell faces** get `preload: true`, in the root layout, where
  they preload on every route.
- **Per-project faces are applied, not preloaded.** A project's display face below the fold of
  an essay (behind a `/work` card click) tolerates `font-display: swap`. If a specific
  above-the-fold project face genuinely must preload, emit the
  `<link rel="preload" as="font" crossorigin>` manually.
- **Verify empirically:** `pnpm build`, visit `/work/<slug>`, view-source the `<head>`, count
  `<link rel="preload" as="font">` — confirm the policy holds (expect the shell faces only).
- **Where the link lands** (initial shell vs streamed hole) is the other axis: keep
  `ProjectScope` in the prerendered shell (§7) so its `<head>` contributions are in the
  initial static HTML.

Mapped onto the islands:

- **Shell fonts** (the garden's own identity) → root layout, `preload: true`. Keep to 1–2
  faces.
- **Per-project fonts** → resolved from the project doc's `fontKey` against the code-side
  roster, applied at its `[data-project]` scope via `.variable`.
- **Shared fonts** → the roster _is_ the single declaration point, so a face two projects use
  is declared **once** and resolved by both.
- **Experience & embed fonts** → neither declares its own `next/font`; each reads
  `--logx-font`, which the project fills from the resolved face.

Practical notes:

- Prefer **variable fonts** (one file, many weights/optical sizes).
- The site is **flash-free for _theming_** (color arrives inline with the markup); fonts are
  **zero-CLS with an intentional `swap`** — next/font's size-adjusted fallback kills layout
  shift but a per-project display face will visibly swap on navigation, by design. Decide
  `swap` vs `optional` per face.

---

## 6. Content model (Sanity)

- **Content lives in Sanity; interaction lives in code.** A `project` document holds the
  essay and references a coded module via `componentKey`; the CMS never reimplements
  interaction.
- **The essay is rich content (portable text), not plain text.** Alongside text it carries
  typed embed blocks — media and live components referenced by key and resolved in code.
- **`brandColor` is per-project, typed, and validated** `[D9]`. It's a field on the `project`
  document (the per-project island seed), stored as a validated string (hex or `oklch()`) or
  via `@sanity/color-input`. **`@sanity/color-input` alone is not sufficient** — its sRGB
  picker can't express the wide-gamut colors you'd want an OKLCH engine for, and doesn't
  guarantee the value survives the contrast math. So add **author-time Sanity `validation`
  that runs the engine's own color pipeline** (parse → gamut-map → confirm in-spec contrast)
  for editor feedback. Defense-in-depth: the engine itself never throws (§3.2) and
  `ProjectScope` falls back to a safe default. `siteSettings` holds the shell's brand, same
  treatment. Each is fed to the OKLCH engine at its own scope.
- **`fontKey` is per-project** — a field on the `project` document, chosen from the curated
  roster (§5). Reference-by-key, exactly like `componentKey` and `brandColor`.
- **No per-scheme color field** `[D5]`. Dark mode is a render-time axis; one `brandColor`
  generates both schemes. A project needing a hand-tuned dark brand gets an _optional_
  `brandColorDark` override, defaulted from the engine — never a required parallel field.
- **Keys are a contract; the Studio never imports implementations** `[D10]`. Each
  reference-by-key pair is split: a tiny `keys.ts` of string constants (imported by the schema
  to build its dropdown) and a separate resolver in the app — `projects/registry.ts`,
  `fonts/roster.ts`, `embeds/registry.ts` — which the Studio never imports. This keeps
  `next/font` and lazy project bundles out of the Studio bundle. With the **standalone Studio**
  `[D23]` this separation is structural (different workspace package), but `keys.ts` must then
  live in a **shared workspace package** both consume — not duplicated (Phase 2). See §4.2 for
  the typed-resolver + fallback discipline that makes the soft foreign key safe.
- **Embeds: generic `liveEmbed` by default; a typed block only for editorial content**
  `[D15]`. A `liveEmbed` block stores an `embedKey` + a caption — use it whenever the only
  authored inputs are key + caption (the demo and the majority of in-essay embeds; adding one
  is zero schema change). Give a widget its **own typed block only when an editor must author
  structured _content_** (text they write, an image they pick, a list they curate). **Never**
  model code-level config (variants, sizes, initial state) as a block or an untyped `props`
  blob — default it in the registry, or split into two registered keys. Litmus: _editor
  writes/curates it → typed block; developer decides it → registry; neither → it's not an
  input._
- **The index query refuses to over-fetch.** The `/work` query pulls `blurb`, `brandColor`,
  `fontKey` — **not** the essay. That enforces "a few colours per card" at the data layer
  (cards feed `cardSwatches`, §3.2 Consumer C) and keeps the index payload small for CWV.
- **`ProjectScope` is the resolution keystone.** One server component takes a scope's
  `brandColor` + `fontKey` and emits the flash-free scoped `<style>` (engine palette, both
  schemes via `light-dark()`) plus the resolved font's `.variable` class. It is **defensive**
  — engine returns a fallback on bad input, and the component is wrapped in `unstable_catchError`
  (`next/error`) as a backstop, **not** a segment `error.tsx` (which doesn't catch its own
  layout's throw — §7) `[D9]`. The shell uses it with `slug="garden"`. It renders in the
  prerendered shell (`use cache`, §7). Everything beneath reads `var(--brand-*)` /
  `var(--font-face)`.
- **Visual editing details** `[D16]`. Disable Sanity **stega** on `brandColor`/`fontKey` —
  the invisible encoding chars break the OKLCH parse and the font-class lookup. `liveEmbed`
  click-to-edit targets the caption/`embedKey` field, not the interactive region.
- **Notes / digital garden**: backlinks via `references()` — but model inter-note links as
  **real Sanity `reference` fields** (not free-text slugs), or `references()` finds nothing
  and you reintroduce key-drift `[D16]`. Note pages stay lightweight (shell + shared
  components) and pull a project demo bundle only if a note explicitly embeds one.
- **Site pages** (home, about, `/now`) are shell-owned, not project modules. Their content can
  live in Sanity, rendered under the shell island's scope (§3.1).
- **TypeGen + `defineQuery`**: typed GROQ; run TypeGen after any schema or query change (a
  committed script + a CI `git diff --exit-code` on the generated types keeps it from
  rotting); `defineQuery` must wrap the query literally (no runtime interpolation).

---

## 7. Repo & hosting

- **Stack.** Next.js 16.2 (App Router, Turbopack default), React 19, Sanity, Vercel. Request
  APIs are async; the renamed `proxy.ts` replaces `middleware.ts` (Node-runtime only — no
  `edge`). **Styling is CSS custom properties only** — no JSON tokens, no Tailwind, no Style
  Dictionary; the OKLCH engine emits CSS vars directly.
- **Cache Components enabled app-wide** `[D11]`. Verified against the installed docs:
  `export const dynamic`/`force-static` are gone — all routes are dynamic-by-default with PPR
  baked in, and static-vs-dynamic is a **component-level** concern (`use cache` + where
  request-time APIs are touched). A route is a **prerendered shell with dynamic holes**. We
  render **`ProjectScope` in the prerendered shell** — `use cache` it (keyed on
  `brandColor`/`fontKey`, `cacheLife('max')`, no request-time APIs in that boundary) — so the
  scoped theme `<style>` and the resolved font class are in the **initial static HTML**
  (flash-free, no streamed delay), while the essay/notes stream. This is an app-wide rendering
  change (request APIs need Suspense or arg-passing; `<Activity>`-based state preservation
  across nav) — a deliberate Phase-0 decision, not a per-surface sprinkle.
- **Error containment is a defensive-engine job, not an error boundary** `[D9]`. Verified: a
  throw in a Server Component bubbles to the nearest _parent_ boundary, and a segment's own
  `error.tsx` does **not** catch a throw from that segment's _layout_ — and `ProjectScope` is a
  layout-level wrapper. So containment is: engine returns a fallback (never throws) +
  `unstable_catchError` around `ProjectScope`. A caught error would also render _unthemed_,
  which is the wrong response to a data-quality problem — hence "validate + fall back," not
  "let it throw and catch."
- **One Next.js app for the site; the Sanity Studio is a separate workspace package** `[D23]`.
  The repo is a two-member pnpm workspace: the Next app at the root and a **standalone Sanity
  Studio in `studio/`** (Vite-based, auto-updating, TypeGen watch mode). The _site_ is still a
  single app with no project sub-packages — project code lives under `src/projects/*`; shared
  bits live in shared `src/` modules. Boundaries are **lint-import rules enforced from Phase 0**
  (a project can't import another project; shared can't import a project), plus the
  `src/lib/oklch/` isomorphism boundary (§3.2) and the every-CSS-module-declares-its-`@layer`
  rule (§3.1).
- The site runs on **Vercel** with full SSR / RSC. The old log-explorer used `output: "export"`
  only to host free on Render — _not_ carried forward. This unlocks server-rendered flash-free
  per-scope OKLCH `<style>` blocks, Sanity draft mode / visual editing, an RSS route handler, a
  `/now` page, and the prerendered-shell-with-streaming model above.

---

## 8. "Don't reach up" litmus (quick reference)

Before shipping a **shared** unit (the litmus is for shared primitives, not every component):

- [ ] Does it render correctly reading only **generic tokens** (`--brand-*`, `--font-face`,
      `--space-*`) plus its own defaults — with no project-specific (`--logx-*`) dependency? `[D2]`
- [ ] Is every themeable value exposed as a **public token** with an internal default?
- [ ] Does it avoid assuming any **themeable ambient context** (a parent's _brand or feel_
      value, a font mounted higher up)? Reading the global **invariant** tier (spacing, motion,
      semantics) is fine — that's plumbing, not a look. `[D1]`
- [ ] If shared, is it **declared once and composed in**, never re-instantiated per island?
- [ ] Does the host theme it **downward** (set the tokens it consumes) rather than the unit
      reaching up?
- [ ] If it has a CSS Module, does that module **declare its `@layer`** (or stay strictly
      var-consuming)? `[D12]`
- [ ] If it registers an embed, is the key **namespaced with the project's prefix** so a
      project-local embed can't silently shadow a shared one?

The litmus stays an **advisory** PR checklist for shared primitives; the parts that can be a
lint rule (import boundaries, `@layer` declaration) are enforced automatically from Phase 0,
not left to human review.
