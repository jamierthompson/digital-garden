# Architecture — system model

The system model for the portfolio + digital garden. Each project is a **self-contained
module** — its pages (always the interactive experience, plus whatever else it needs: an essay,
a hero, rich media), the components its essay embeds, and its tokens — composed within the site.
Hosted on Vercel; essay + brand seeds in Sanity.

This is the **reference for how the system is designed**, cited across the codebase as `§N`
(e.g. `§3.2`, `§4.1`). Binding decisions are recorded in [`../decisions.md`](../decisions.md) and
cited as `[D#]`; **where this doc and the decisions log ever disagree, the decisions log wins.**
Token prefixes like `--<proj>-*` below are per-project placeholders.

**Build status (2026-06-30).** Some material below describes **decided** state the running code (or
this doc) hasn't caught up to yet — each tracked by an issue:

- slot-scoped theming under a global editorial chrome `[D30]` → #58;
- a single `project` type with a `maturity` field `[D34]` + Day-1 backlinks `[D35]` → #59;
- flat `/[slug]` routes `[D36]` → #60;
- the foundation → semantic → brand token model `[D1, D2]` → code in #57.

**Caveat:** §3.1 below still shows the **old** token tiers (foundation / brand+font / feel) — its
prose has not been reconciled to `[D1]`/`[D2]` yet. That reconciliation is **#63**.

---

## 1. Guiding principles

These are the through-lines; everything else follows from them.

- **Modules, not a monolith.** The thing to avoid is a single fused bundle with no internal
  seams. Each project is a self-contained module — its tokens, UI, pages, and interactive
  experience — that the site's routes load. Genuinely shared parts (token recipes, the OKLCH
  engine, the odd reused primitive) live in plain shared modules. No fused bundle; no premature
  abstraction either.

- **Composition over inheritance.** Every page wears one global editorial look — Newsreader + a
  neutral black/white/gray ramp — at the shared foundation tier. Each project carries its **own brand
  color and font** scoped to its **interactive slot** (the `<Experience/>` / `[data-project]`
  wrapper) — self-themed _within_ the page, not across it `[D30]`. Projects are not
  variations of one global _brand_; they are self-assembled from shared parts. "Shared" is a
  build-time authoring convenience for the foundation tier and a runtime parent only for genuinely
  shared plumbing `[D1]`.

- **Self-sufficient contracts; theme downward; never reach up _for a look_.** Every unit — a
  token group, a component, a project module — ships its own defaults and is themed by whatever
  composes it _downward_. Nothing depends on **themeable** ambient context (a brand or feel
  value) provided by an ancestor it doesn't own. It _may_ depend on the global **foundation**
  layer (spacing, motion, breakpoints, z-index) — that's shared plumbing, not a
  look. This is the precise form of "don't reach up the tree," and it generalizes the
  `var(--public-override, var(--_internal-default))` pattern from leaf primitives across the
  system — but as **composition-time** theming (a host sets the tokens a child reads), not
  runtime re-derivation of an engine's computed ramp `[D3]`.

- **Right-sized, not maximal.** This is one app with a handful of projects, not a set of
  shippable packages. Slot-scoped theming, downward theming, and the don't-reach-up discipline stay
  only where they earn their keep. The foundation is shared globally (and carries the global
  editorial look), and only **brand + font + feel** are scoped to each project's slot `[D1, D30]`; a
  small foundation _coordination_ layer is the norm (§3.1), the
  embed registry starts single-tier (§4.1), and the litmus (§8) applies to shared primitives, not
  every component. Concentrate the sophistication where it pays — the OKLCH engine (the
  load-bearing, genuinely hard piece), the content model, performance — and let the rest be
  boringly simple.

---

## 2. Code vs content

Two homes:

- **The Next app** — all code: each project's pages, its interactive experience (a working
  demo), and the components its essay embeds. Each project is a self-contained module under
  `src/projects/<slug>/`; shared parts live in plain shared modules.
- **Sanity** — content & brand seeds: one `project` document type `[D34]` — essay (rich text with
  embeds), tags, a `maturity` stage, `related` backlinks `[D35]`, an optional `featuredRank`,
  per-project `brandColor`, `fontKey`, and the `componentKey` reference.

Within a project the division is code vs content, but the line isn't a wall. The interactive
experience and the components are code; the essay is content. The essay is _rich_, though — it
can embed media and live components (including the demo itself, in place of screenshots) by key —
per-project or shared, the same reference-by-key move as `componentKey` (§4.1–4.2, §6). The
experience's logic lives in a headless core when it earns one (§4.3), but that's ordinary code
organization, not a boundary the site has to maintain.

The shell's top-level pages — home, about, `/now` — are owned by the site rather than any project
module, and wear the global editorial look like every other page (§3.1).

---

## 3. Token & theming architecture

### 3.1 Three tiers: foundation (global), brand+font (engine-scoped), feel (scoped override) `[D1]`

What actually varies per project is **brand color, font, and the feel/geometry set** — not
spacing, type-scale ratios, motion, or breakpoints, which are house style. So the system is three
tiers:

| Tier                | Lives at                                                         | Contents                                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Foundation**      | global `:root`                                                   | the global editorial look (Newsreader + the neutral B/W/gray ramp, chrome colors/backgrounds), spacing ramp, motion curves/durations, breakpoints, z-index scale, type-scale ratios, focus-ring **geometry**, the reset |
| **Brand + font**    | the project's interactive slot (`[data-project]`), engine-driven | the OKLCH color ramp (incl. focus-ring _color_ and brand-derived status colors), + the resolved font face — scoped to the slot, flash-free                                                                              |
| **Feel / geometry** | the slot (`[data-project]`), small override set                  | corner radius, border weight, shadow softness, density — defaults inherited from the foundation tier, overridden only where a project genuinely differs                                                                 |

A project's page chrome (title, prose, nav) reads the **global editorial tier**. Its **interactive
slot** and the components embedded inside it read **one per-project token namespace** — e.g.
`--<proj>-*` — for the brand/feel tier, on top of the global foundation tier `[D30]`.

```
global :root  (the foundation tier — the editorial look + shared plumbing)
   ├─ EDITORIAL LOOK: Newsreader · neutral B/W/gray ramp · chrome colors/backgrounds
   ├─ spacing ramp · motion curves · breakpoints · z-index · type-scale ratios
   ├─ focus-ring GEOMETRY · reset
   └─ @layer foundation, brand, project;   ← bare order statement, loaded first [D12]
          │ every page's chrome (nav · headers · prose) reads this tier ↓
   home · about · /now · the project page AROUND the slot   — all editorial, no brand [D30]
          │ and inside a project page, one bounded slot is themed ↓
[data-project="<slug>"]   the project's interactive slot — declares ONLY its brand + font + feel
   ├─ brand tokens   ◄── OKLCH engine ◄── this project's brandColor (from Sanity)
   ├─ status colors  ◄── derived from the brand hue by the engine [D32]
   ├─ font           ◄── resolved face's .variable class [D11]
   ├─ feel overrides (radius/border/shadow/density) — only where it differs
   └─ --<proj>-*     internal alias mapped from the generic --brand-* / --font-face [D2]
          │ themes downward, within the slot ↓
   the slot's experience + embeds   read var(--brand-*) / var(--font-face) / var(--space-*)
          └─ [data-experience-surface]  optional scoped reset for an interactive surface
```

Key points:

- **The public token contract is the GENERIC layer** `[D2]`. Shared, cross-project units read
  `--brand-*`, `--font-face`, and the global `--space-*`/foundation tokens — never a
  project-prefixed `--<proj>-*`, because a shared embed cannot know a project's prefix. The
  project-prefixed name is a project-internal _alias_ mapped from the generic names; it exists for
  the project's own code, not as the contract.

- **No global _brand/feel_ values; foundation IS global** `[D1]`. The rule is not
  "nothing themeable at `:root`" — it is "nothing that carries a project's _brand or feel_ at
  `:root`." Spacing/motion/breakpoints/type-ratios are themeable-in-principle but
  invariant-in-practice, so they live globally and a scope may _override_ a feel token via normal
  cascade (still downward theming). The **global editorial look** (Newsreader + the neutral ramp) is
  also a foundation-tier global — house style, not a project's brand `[D30]`. The brand ramp always
  lives in the slot scope, because it genuinely varies and must be flash-free per slot.

- **Every CSS Module must declare its `@layer`** `[D12]`. Next does **not** auto-assign CSS
  Modules to a cascade layer, and an _unlayered_ module's plain declarations outrank **every**
  `@layer` style regardless of specificity or source order. So any component CSS Module that sets
  real properties must wrap its body in `@layer project { … }` (or stay strictly var-_consuming_);
  the engine's scoped `<style>` declares `@layer brand`; the bare `@layer foundation, brand,
project;` order statement is emitted in a global sheet loaded first. Lint-enforced (§8).

- **Cascade order via `@layer`** (foundation < brand < project) to kill CSS-module insertion-order
  accidents instead of fighting specificity. The global order statement must register before
  `next/font` — pinned by import order in the root layout `[D27]`.

- **Breakpoints are not `:root` custom properties** `[D22]`. CSS variables are invalid inside
  `@media` conditions, so breakpoints are build-time constants / container queries; custom props
  can still feed JS.

### 3.2 The OKLCH engine

The engine is the load-bearing, genuinely hard piece of the system — not a lightness ramp but a
small color _system_. It is **both a feature and a project — same logic, two-plus consumers.**

- A **pure function**: takes a brand color **and a scheme**, emits a color-token set. Knows
  nothing about projects. Lives in its own workspace package (`packages/oklch`, imported as
  `@garden/oklch` `[D23]`) — no React, no DOM, no Node built-ins — as the single source of truth
  for the algorithm. Its isomorphism is **enforced**, not hoped: a lint import-boundary on the
  package forbids `next/*`, `react`, `react-dom`, and DOM/Node globals, and a dual-environment
  test runs the suite under both `node` and `jsdom`. (Do **not** use `server-only`/`client-only` —
  those pin it to one side and break the requirement.) `[D14]`

- **Scheme-aware** `[D5]`. The signature is `(brandColor, scheme) → tokenSet`. One `brandColor`
  per project generates **both** light and dark ramps — dark is reduced chroma + shifted surface L
  with on-color contrast re-solved, not "invert L." The scoped `<style>` emits both via CSS
  `light-dark()` so a single block carries both schemes and switching is pure CSS, respecting
  `prefers-color-scheme`. A seed too light to serve as the light-mode primary is auto-assigned as
  the **dark-mode** brand, with the light-mode brand derived from it.

- **Contrast is solved, not stepped** `[D4]`. OKLCH `L` is perceptual lightness, _not_ WCAG
  relative luminance or APCA Lc — a fixed ΔL passes for a blue brand and fails for yellow/cyan at
  the same steps. The engine takes a contrast target (APCA Lc for text, WCAG 2.x as compliance
  fallback) and binary-searches `L` for on-brand/on-surface pairs against the relevant background.

- **Gamut-map before contrast math** `[D6]`. OKLCH chroma routinely exceeds sRGB and even P3; the
  engine cusp-maps (Ottosson-style chroma reduction toward the boundary) to the chosen target
  gamut (P3 vs sRGB, chosen explicitly) _before_ computing contrast, so the math is done against
  the color the screen actually shows.

- **Bakes literal `oklch()` values server-side** `[D3]`. The engine emits resolved, gamut-mapped,
  contrast-solved literals — not relative-color CSS. Live per-token CSS override is explicitly
  **not** a goal: no consumer needs the cascade to re-derive a mid-chain token (the playground and
  card swatches re-run the pure function in JS). Relative-color (`oklch(from …)`) is permitted only
  for decorative, non-contrast deltas. This is also what makes server-side validation possible.

- **Focus-ring _color_ is an engine token** `[D7]`; only its geometry is part of the global foundation. The
  global reset is kept free of other smuggled looks (`::selection`, `accent-color`, default link
  color) — those belong in the scoped tier.

- **Status colors are brand-derived** `[D32]`. `success`/`error`/`warning`/
  `info` are generated by the engine from each slot's brand hue — scheme-aware and contrast-solved
  like the rest of the ramp — so every project slot carries status colors harmonized with its brand,
  not a single fixed global signal set. Build is deferred until the first status-bearing UI lands;
  see the GitHub issue tracker.

- **Defensive, never throws** `[D9]`. `brandColor` comes from an editor and may be invalid or
  out-of-gamut. The engine parses/clamps/gamut-validates and **returns a safe fallback palette**
  rather than throwing — a bad color is expected data, not an exceptional bug. This pairs with
  author-time Sanity validation (§6) and a `ProjectScope` backstop (§6, §7).

- Runs **per slot** — once per project slot (seeded by that project's `brandColor`). Multiple themed
  slots can coexist on one page; the page chrome around them stays editorial. **Previews are not
  slots**: an index card or inline preview needs a few colors, not a namespace, so it derives them
  from the same engine (Consumer C) and skips the scoped `<style>` block.

- Emitted as a **server-rendered scoped `<style>` block** (`[data-project="x"] { … }`), declared
  `@layer brand`. On Vercel this is genuinely **flash-free for color**: the `brandColor` is known
  on the _server_, so the `<style>` is in the initial HTML, server/client RSC payloads agree, and
  there's no hydration mismatch and no FOUC. Emit via `dangerouslySetInnerHTML`. If `ProjectScope`
  can ever be _suspended_, use React 19 `<style href={`theme-${slug}`} precedence>` so the
  boundary blocks on it before paint; if it renders in the shell above any Suspense (the common
  case), plain inline is already flush-before-paint. `[D13]`

- The **mapping** of generated brand tokens into the project namespace
  (`--<proj>-accent: var(--brand-accent)`) lives in the project scope, not in the engine.

**Three consumers, one engine:**

- **Consumer A — the theming feature**: the per-slot theming layer (`ProjectScope`) calls the
  engine on the server to emit each slot's `<style>` block.
- **Consumer B — the portfolio piece**: `src/projects/oklch-engine/` is an ordinary project module
  (§4) whose interactive experience is a playground (drag a hue, watch the palette regenerate). The
  experience **imports the same shared engine** — it never reimplements it, and re-runs the pure
  function in JS on each slider move (it does not rely on CSS re-derivation).
- **Consumer C — preview swatches**: the index (and inline previews) call a
  `cardSwatches(brandColor)` helper that runs the **same engine** and returns just a few stops. The
  card sets them as inline `--c-*` custom properties on otherwise-editorial chrome — no slot scope,
  no `<style>` block, no full namespace. It goes through the same parse/validate path as everything
  else.

Two deliberate consequences:

- **It themes itself, on purpose.** The oklch-engine project's slot is themed like any other, so
  its own brand tokens are generated by the engine it showcases. No circular dependency in code
  (the project depends on the engine; the engine depends on nothing).
- **Keep it isomorphic** (enforced — see above).

The anti-pattern to avoid: putting the engine _inside_ a project module and having the theming
layer reach up into a portfolio piece for infrastructure — that inverts the dependency direction.
Shared logic lives in a shared module; the project is a presentation of it.

### 3.3 Downward theming

The **project's slot scope is the single downward-theming owner** for brand + feel: it declares the
project's brand tokens (from the OKLCH engine) plus any feel overrides, and themes everything
beneath it — the slot's interactive experience and the components it embeds — by passing those
values _down_. They all read the same scoped tokens; the slot scope is the authority. The page
chrome around the slot reads the global editorial tier; the foundation tier sits above, shared.

The directional rule:

- **Host themes the child downward** by setting the tokens the child consumes. Fine.
- **Child reaching up** for an ancestor's _themeable_ (brand/feel) value. Banned.
- **Reading the global _foundation_ tier** (spacing, motion). Allowed — it's shared plumbing, not a
  look `[D1]`.

The override surface is precise `[D3]`: you override the **seed** (re-run the engine, server-side,
per scope) **or** a **leaf consumable token** (`--brand-accent`, `--font-face` — a literal a host
sets and a component reads). You never override a _mid-chain derived_ token and expect its
derivatives to recompute — the engine baked them. The `var(--public, var(--_internal-default))`
pattern is for composition-time downward theming of primitives, not live ramp re-derivation.

Self-sufficiency still applies _within_ the slot: a shared primitive must not assume tokens from
any _specific_ project's scope. It ships its own defaults and reads generic names (`--brand-*`,
`--font-face`), so it works composed into any project (or none).

---

## 4. Project modules

### 4.1 Structure

```
src/projects/<slug>/
  ├─ pages/             the project's own page components — essay / hero / other
  ├─ experience.tsx     the interactive experience (the working demo); a thin page mounts it [D20]
  ├─ core/              headless core — ONLY when the experience's logic earns extraction [D20]
  ├─ embeds.ts          project-local embed map (key → component) — bespoke inline embeds
  ├─ tokens.css         the project's scoped brand + feel (--<proj>-* mapped from --brand-*)
  └─ index.ts           registry entry
src/fonts/roster.ts        curated next/font declarations, one per face, exported by key
src/lib/resolvers/embeds.ts      embedKey → embed-component loader — cross-project widgets [D10]
src/lib/resolvers/components.ts  componentKey → () => import("@/projects/<slug>")  [literal imports, D21]
src/*/keys.ts              string-constant key contracts (Studio imports these; resolvers don't) [D10]
```

A project is **one or more pages**. The interactive experience is the only constant; beyond it a
project may have an essay/rich-media page, a hero, something else, or nothing more at all — the
page set is decided per project, not fixed by a template. `experience.tsx` is the component; a thin
page in `pages/` mounts it `[D20]`. A headless `core/` is **not** templated into every module —
let it emerge only when an experience's logic warrants extraction (same deferral discipline as the
embed tiers) `[D20, §4.3]`. The module owns its page components; thin route files mount them. Code
lives under `src/projects/<slug>/`; **routes are flat** `[D36]` — `/` is the index of project
cards, and a root-level `/<slug>` (a dynamic segment that cedes precedence to static segments like
`/about`, `/now`) mounts a project's pages.

**Start single-tier** — one shared `src/lib/resolvers/embeds.ts` until a second project actually reuses a
widget; introduce the project-local tier only then `[D24]`. Once you do, embeds follow the **same
per-project-plus-shared shape as tokens and fonts**. For a given project the resolver composes the
two (`{ ...shared, ...projectLocal }`) so a project-local key **overrides** a shared one of the same
name — the downward-override spirit of `var(--public-override, var(--_internal-default))`. A
_shared_ embed themes off the **generic** tokens (`--brand-*`, `--font-face`), never a
project-prefixed alias `[D2]`. Promote a widget into the shared registry only once it's genuinely
reused; both tiers lazy-import.

Most UI belongs to its project module; lift a primitive into a shared `src/` module only once it's
genuinely reused across projects — not preemptively. A project may also _consume_ shared logic
without owning it — the oklch-engine project's experience imports the shared engine rather than
holding it (§3.2).

### 4.2 The CMS ↔ code registry

```
Sanity project doc { componentKey: "<slug>", brandColor, fontKey, copy, maturity, related, featuredRank, tags }
        │
        ▼
src/lib/resolvers/components.ts   componentKey "<slug>" → lazy import of the project module
        │
        ▼
src/projects/<slug>/   its pages (experience + any essay/hero/other) + embeddable components
```

- **Content references; code resolves.** The essay comes from Sanity and references coded
  components by key, resolved against the project-local `embeds.ts` first, then the shared
  `src/lib/resolvers/embeds.ts`. The CMS never reimplements interaction.
- **Keys are a contract with no referential integrity — guard the seam** `[D10]`. `keys.ts` is the
  **single source of truth** for which keys exist; resolvers are typed `satisfies Record<Key, …>`
  so a missing resolver entry is a **compile error** (converts code→code drift from a runtime crash
  into a build break). Resolvers return a typed `NotFound`, never a bare `map[key]` lookup, so the
  content→code direction (a saved Sanity key whose code was renamed/deleted) degrades to a visible
  fallback instead of crashing — `not-found.tsx` for a `componentKey`/slug miss, a "missing embed"
  placeholder in the Portable Text serializer for an `embedKey` miss. (A CI check that GROQs all
  _published_ keys and asserts each exists in code is an additive safety net, tracked in the issue
  backlog — not a schema decision.)
- **Lazy-load each module** via a **literal** dynamic import per key
  (`() => import("@/projects/<slug>")`, never a templated `import(\`…/${slug}\`)`, which defeats
bundler static analysis) `[D21]`. Server Components are auto-split already; the manual lazy import
  buys conditional inclusion, and the real client-bundle savings come from the Client Components
  _inside_ each module.

### 4.3 The interactive experience: logic in a headless core (when it earns one)

Each project's interactive experience is a demo that actually works. As a general engineering
practice — not for any packaging or reuse goal — its logic _can_ live in a **headless core** (hooks
/ pure functions — state machines, reducers, derivations), with presentation as separate primitives
the experience composes. That split is internal hygiene only, and it is **not mandatory**: a
toggle/slider demo doesn't need a state machine in a separate folder. Extract a `core/` when the
logic warrants it `[D20]`.

There's no demo-vs-experience boundary to maintain. The experience owns its own state and renders
directly. The same interactive experience — or smaller bespoke live components — can be **embedded
inline in an essay** by key, in place of screenshots (§6), under the same project scope, so it
themes identically.

---

## 5. Fonts

**Store-the-key (roster-by-key).** A curated roster of faces is declared in code (each a `next/font`
export, in a single shared module); Sanity stores a `fontKey` per project and the editor picks from
a dropdown; the project's **slot scope** applies the face that key resolves to, via that face's
**`.variable` class** on the `[data-project]` wrapper, with `--<proj>-font` mapping to it; page
chrome stays on the editorial face `[D11, D30]`. This keeps
`next/font`'s self-hosting, subsetting, and zero-CLS sizing while putting a project's type choice on
its document alongside its brand color.

`next/font` must be called at module scope, so the roster can't be _arbitrary_: an editor picks from
the curated set, never a free-text name or upload. **Adding a face to the roster is a code change;
choosing among existing faces is content.**

Two facts make a large roster cheap:

1. **Declaration ≠ download.** Calling `next/font` emits an `@font-face` + a CSS variable; the
   browser only fetches a font file when rendered text uses that family. Declaring fifty fonts costs
   zero downloads on a page that uses none of them.
2. **Preload is build-time static analysis — and `fontKey` is a runtime index** `[D11]`. `next/font`
   injects `<link rel=preload>` for a face it can _statically_ see a route reference. Because the
   roster resolves `fontKey` (a Sanity string) → face at **runtime**, Next cannot target the
   resolved per-project face for preload. This is **not** an SSG-vs-dynamic question (that
   route-level toggle is gone under Next 16 `cacheComponents`, §7) — it's a
   build-time-static-analyzability question, independent of caching.

So, the policy:

- **`preload: false` on every roster face** by default (the default is `true`, so this must be set
  explicitly). Only the **1–2 editorial faces** get `preload: true`, in the root layout, where they
  preload on every route.
- **Per-project faces are applied, not preloaded.** A project's slot face (behind a `/<slug>` click)
  tolerates `font-display: swap`. If a specific above-the-fold project face genuinely must preload,
  emit the `<link rel="preload" as="font" crossorigin>` manually.
- **Verify empirically:** `pnpm build`, visit `/<slug>`, view-source the `<head>`, count
  `<link rel="preload" as="font">` — confirm the policy holds (expect the editorial face only).
- **Where the link lands** (initial shell vs streamed hole) is the other axis: keep `ProjectScope`
  in the prerendered shell (§7) so its `<head>` contributions are in the initial static HTML.

Mapped onto the layers:

- **The editorial face** (the site's global identity — Newsreader) → root layout, `preload: true`.
  Every page's chrome uses it. Keep to 1–2 faces.
- **Per-project fonts** → resolved from the project doc's `fontKey` against the code-side roster,
  applied at the project's `[data-project]` **slot** scope via `.variable` — they theme the slot,
  not the page `[D30]`.
- **Shared fonts** → the roster _is_ the single declaration point, so a face two projects use is
  declared **once** and resolved by both.
- **Experience & embed fonts** → neither declares its own `next/font`; each reads `--<proj>-font`,
  which the project fills from the resolved face.

Practical notes:

- Prefer **variable fonts** (one file, many weights/optical sizes).
- The site is **flash-free for _theming_** (color arrives inline with the markup); fonts are
  **zero-CLS with an intentional `swap`** — next/font's size-adjusted fallback kills layout shift but
  a per-project slot face will visibly swap as its slot mounts, by design. Decide `swap` vs
  `optional` per face.

---

## 6. Content model (Sanity)

- **Content lives in Sanity; interaction lives in code.** A `project` document holds the essay and
  references a coded module via `componentKey`; the CMS never reimplements interaction.
- **One document type — `project`** `[D34]`. A "note" and a "project" share this type; the
  difference is scope (a note is shorter, single-topic), not schema. A **`maturity`** field (sketch →
  prototype → shipped) is the honesty badge, independent of scope and of curation (`featuredRank`).
  The display label is decoupled from the `_type`; a second type is deferred until a shipped piece
  proves divergent fields `[D24]`.
- **The essay is rich content (portable text), not plain text.** Alongside text it carries typed
  embed blocks — media and live components referenced by key and resolved in code.
- **`brandColor` is per-project, typed, and validated** `[D9]`. It's a field on the `project`
  document (the slot seed), stored as a validated string (hex or `oklch()`). Author-time Sanity
  `validation` runs the engine's own color pipeline (parse → gamut-map → confirm in-spec contrast)
  for editor feedback. Defense-in-depth: the engine itself never throws (§3.2) and `ProjectScope`
  falls back to a safe default. `siteSettings` holds the site title/description and may seed a
  homepage slot; it does not brand the chrome `[D30]`.
- **`fontKey` is per-project** — a field on the `project` document, chosen from the curated roster
  (§5). Reference-by-key, exactly like `componentKey` and `brandColor`.
- **No per-scheme color field** `[D5]`. Dark mode is a render-time axis; one `brandColor` generates
  both schemes. A project needing a hand-tuned dark brand gets an _optional_ `brandColorDark`
  override, defaulted from the engine — never a required parallel field. (A seed too light to be the
  light-mode primary is auto-assigned as the dark brand; see §3.2.)
- **Keys are a contract; the Studio never imports implementations** `[D10]`. Each reference-by-key
  pair is split: a tiny `keys.ts` of string constants (imported by the schema to build its dropdown)
  and a separate resolver in the app — `lib/resolvers/components.ts`, `lib/resolvers/fonts.ts`,
  `lib/resolvers/embeds.ts` — which the Studio never imports. This keeps `next/font` and lazy project
  bundles out of the Studio bundle. With the **standalone Studio** `[D23]` this separation is
  structural (different workspace package), so `keys.ts` lives in a shared workspace package both
  consume rather than being duplicated. See §4.2 for the typed-resolver + fallback discipline that
  makes the soft foreign key safe.
- **Embeds: generic `liveEmbed` by default; a typed block only for editorial content** `[D15]`. A
  `liveEmbed` block stores an `embedKey` + a caption — use it whenever the only authored inputs are
  key + caption (the demo and the majority of in-essay embeds; adding one is zero schema change).
  Give a widget its **own typed block only when an editor must author structured _content_** (text
  they write, an image they pick, a list they curate). **Never** model code-level config (variants,
  sizes, initial state) as a block or an untyped `props` blob — default it in the registry, or split
  into two registered keys. Litmus: _editor writes/curates it → typed block; developer decides it →
  registry; neither → it's not an input._
- **The index query refuses to over-fetch.** The index query pulls `blurb`, `brandColor`, `fontKey`,
  `maturity`, `featuredRank` — **not** the essay. That enforces "a few colors per card" at the data
  layer (cards feed `cardSwatches`, §3.2 Consumer C) and keeps the index payload small for CWV.
- **`ProjectScope` is the resolution keystone.** One server component takes a scope's `brandColor` +
  `fontKey` and emits the flash-free scoped `<style>` (engine palette, both schemes via
  `light-dark()`) plus the resolved font's `.variable` class. It wraps a project's **interactive
  slot** (and any homepage slot `siteSettings` seeds), not the page chrome `[D30]`. It is
  **defensive** — engine returns a fallback on bad input, and the component is wrapped in
  `unstable_catchError` (`next/error`) as a backstop, **not** a segment `error.tsx` (which doesn't
  catch its own layout's throw — §7) `[D9]`. It renders in the prerendered shell (§7); the slot's
  subtree reads `var(--brand-*)` / `var(--font-face)`.
- **Visual editing details** `[D16]`. Disable Sanity **stega** on `brandColor`/`fontKey` — the
  invisible encoding chars break the OKLCH parse and the font-class lookup. `liveEmbed`
  click-to-edit targets the caption/`embedKey` field, not the interactive region.
- **Backlinks are Day-1** `[D35]`. A `project` carries a `related` reference array targeting other
  `project` docs — **real Sanity `reference` fields**, not free-text slugs (or `references()` finds
  nothing and you reintroduce key-drift `[D16]`) — and the read path resolves **incoming** backlinks
  via GROQ `references()`, so an edge authored once shows on both ends. A note is a shorter-scope
  `project` `[D34]`; short pieces stay lightweight (chrome + shared components) and pull a demo
  bundle only if one explicitly embeds it.
- **Site pages** (home, about, `/now`) are shell-owned, not project modules. Their content can live
  in Sanity, rendered with the global editorial look (§3.1).
- **TypeGen + `defineQuery`**: typed GROQ; run TypeGen after any schema or query change (a committed
  script + a CI `git diff --exit-code` on the generated types keeps it from rotting); `defineQuery`
  must wrap the query literally (no runtime interpolation).

---

## 7. Repo & hosting

- **Stack.** Next.js 16 (App Router, Turbopack default), React 19, Sanity, Vercel. Request APIs are
  async; the renamed `proxy.ts` replaces `middleware.ts` (Node-runtime only — no `edge`). **Styling
  is CSS custom properties only** — no JSON tokens, no Tailwind, no Style Dictionary; the OKLCH
  engine emits CSS vars directly.
- **Cache Components enabled app-wide** `[D11]`. `export const dynamic`/`force-static` are gone — all
  routes are dynamic-by-default with PPR baked in, and static-vs-dynamic is a **component-level**
  concern (`use cache` + where request-time APIs are touched). A route is a **prerendered shell with
  dynamic holes**. `ProjectScope` (wrapping a project's slot) renders into the prerendered shell so the scoped theme
  `<style>` and the resolved font class are in the **initial static HTML** (flash-free, no streamed
  delay), while the essay streams. This is an app-wide rendering model (request APIs need Suspense or
  arg-passing; `<Activity>`-based state preservation across nav).
- **Error containment is a defensive-engine job, not an error boundary** `[D9]`. A throw in a Server
  Component bubbles to the nearest _parent_ boundary, and a segment's own `error.tsx` does **not**
  catch a throw from that segment's _layout_ — and `ProjectScope` is a layout-level wrapper. So
  containment is: engine returns a fallback (never throws) + `unstable_catchError` around
  `ProjectScope`. A caught error would also render _unthemed_, the wrong response to a data-quality
  problem — hence "validate + fall back," not "let it throw and catch."
- **One Next.js app for the site; the Sanity Studio is a separate workspace package** `[D23]`. The
  repo is a two-member pnpm workspace: the Next app at the root and a **standalone Sanity Studio in
  `studio/`** (Vite-based, auto-updating, TypeGen watch mode). The _site_ is still a single app with
  no project sub-packages — project code lives under `src/projects/*`; shared bits live in shared
  `src/` modules. Boundaries are **lint-import rules**: a project can't import another project;
  shared can't import a project; plus the `packages/oklch/**` isomorphism boundary (§3.2) and the
  every-CSS-module-declares-its-`@layer` rule (§3.1).
- The site runs on **Vercel** with full SSR / RSC. This unlocks server-rendered flash-free per-scope
  OKLCH `<style>` blocks, Sanity draft mode / visual editing, an RSS route handler, a `/now` page,
  and the prerendered-shell-with-streaming model above.

---

## 8. "Don't reach up" litmus (quick reference)

Before shipping a **shared** unit (the litmus is for shared primitives, not every component):

- [ ] Does it render correctly reading only **generic tokens** (`--brand-*`, `--font-face`,
      `--space-*`) plus its own defaults — with no project-specific (`--<proj>-*`) dependency? `[D2]`
- [ ] Is every themeable value exposed as a **public token** with an internal default?
- [ ] Does it avoid assuming any **themeable ambient context** (a parent's _brand or feel_ value, a
      font mounted higher up)? Reading the global **foundation** tier (spacing, motion) is fine —
      that's plumbing, not a look. `[D1]`
- [ ] If shared, is it **declared once and composed in**, never re-instantiated per slot?
- [ ] Does the host theme it **downward** (set the tokens it consumes) rather than the unit reaching
      up?
- [ ] If it has a CSS Module, does that module **declare its `@layer`** (or stay strictly
      var-consuming)? `[D12]`
- [ ] If it registers an embed, is the key **namespaced with the project's prefix** so a
      project-local embed can't silently shadow a shared one?

The litmus is an **advisory** PR checklist for shared primitives; the parts that can be a lint rule
(import boundaries, `@layer` declaration) are enforced automatically, not left to human review.
