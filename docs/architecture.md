# Architecture — system model

The system model for the portfolio + digital garden. Each project is a **self-contained
module** — its pages (always the interactive experience, plus whatever else it needs: an essay,
a hero, rich media), the components its essay embeds, and its tokens — composed within the site.
Hosted on Vercel; essay + brand seeds in Sanity.

This is the **reference for how the system is designed**; code and the other docs point back to
its sections by name. This document is the current truth; it is edited in place as the system
evolves, and git history is the audit trail — there is no separate decision log to reconcile
against. Where any doc and the framework disagree, **the bundled Next docs win**
(`node_modules/next/dist/docs/`) — your training data is stale on this stack.

**Build status (2026-07-01).** The shared foundation, the OKLCH engine, the Sanity content model,
and the first project are live. Some material below describes the **designed** state that the
running code hasn't fully caught up to yet — each tracked by a GitHub issue. Until these land the
code still names the content type `project`, has no `kind` field, and routes under `/work`:

- one `entry` document type with a `kind` discriminator (note · essay · project · now), `stage`,
  an authored `iterated` date, self-referencing `related` backlinks, and `featuredRank` → #59;
- flat root-level `/[slug]` routes, a featured front door at `/`, and the browsable **Index** → #60;
- seed entries proving the engine across brands → #65.

---

## Guiding principles

These are the through-lines; everything else follows from them.

- **Modules, not a monolith.** The thing to avoid is a single fused bundle with no internal
  seams. Each project is a self-contained module — its tokens, UI, pages, and interactive
  experience — that the site's routes load. Genuinely shared parts (token recipes, the OKLCH
  engine, the odd reused primitive) live in plain shared modules. No fused bundle; no premature
  abstraction either.

- **Composition over inheritance.** Every page wears one global editorial look — Newsreader + a
  neutral black/white/gray ramp — supplied by the foundation and semantic layers at `:root`. Each
  project carries its **own brand color and font**, scoped to its **interactive slot** (the
  `<Experience/>` / `[data-project]` wrapper), where it re-defines the semantic tokens with its own
  values — self-themed _within_ the page, not across it. Projects are not variations of one global
  _brand_; they are self-assembled from shared parts. "Shared" is a build-time authoring convenience
  for the foundation layer and a runtime parent only for genuinely shared plumbing.

- **Self-sufficient contracts; theme downward; never reach up _for a look_.** Every unit — a
  token group, a component, a project module — ships its own defaults and is themed by whatever
  composes it _downward_. Nothing depends on **themeable** ambient context (a brand value) provided
  by an ancestor it doesn't own. It _may_ depend on the global **foundation** layer (spacing,
  motion, breakpoints, z-index) — that's shared plumbing, not a look. This is the precise form of
  "don't reach up the tree," and it generalizes the `var(--public-override, var(--_internal-default))`
  pattern from leaf primitives across the system — but as **composition-time** theming (a host sets
  the tokens a child reads), not runtime re-derivation of an engine's computed ramp.

- **Right-sized, not maximal.** This is one app with a handful of projects, not a set of
  shippable packages. Slot-scoped theming, downward theming, and the don't-reach-up discipline stay
  only where they earn their keep. The foundation and the semantic defaults are shared globally (and
  carry the global editorial look); only the **brand layer** — a slot's full override of the semantic
  tokens — is scoped to each project's slot. A small foundation _coordination_ layer is the norm (see
  the token & theming architecture below), the embed registry starts single-tier (see project
  modules), and the don't-reach-up litmus applies to shared primitives, not every component.
  Concentrate the sophistication where it pays — the OKLCH engine (the load-bearing, genuinely hard
  piece), the content model, performance — and let the rest be boringly simple.

---

## Code vs content

Two homes:

- **The Next app** — all code: each project's pages, its interactive experience (a working
  demo), and the components its essay embeds. Each project is a self-contained module under
  `src/projects/<slug>/`; shared parts live in plain shared modules.
- **Sanity** — content & brand seeds: one `entry` document type covering every content kind — a
  `kind` discriminator (note · essay · project · now), a Portable Text body (rich text with embeds), tags,
  a `stage` (sketch → prototype → shipped), an authored `iterated` date, self-referencing `related`
  backlinks, an optional `featuredRank`, and the per-entry `brandColor` / `fontKey` / `componentKey`
  reference-by-key seeds.

Within a project the division is code vs content, but the line isn't a wall. The interactive
experience and the components are code; the essay is content. The essay is _rich_, though — it
can embed media and live components (including the demo itself, in place of screenshots) by key —
per-project or shared, the same reference-by-key move as `componentKey` (see project modules and
the content model). The experience's logic lives in a headless core when it earns one (see the
interactive experience section), but that's ordinary code organization, not a boundary the site has
to maintain.

The shell's top-level pages — the featured home, the browsable Index, about, `/now` — are owned by
the site rather than any entry, and wear the global editorial look like every other page (see the
token & theming architecture).

---

## Token & theming architecture

### Three layers: foundation (primitives) → semantic (role tokens) → brand (slot override)

Tokens are organized in **three layers**, each consuming the one before it:

| Layer          | Lives at                                          | Contents                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Foundation** | global `:root`                                    | the raw primitives + the reset: the neutral B/W/gray ramp, the Newsreader face, the spacing ramp, motion curves/durations, type-scale ratios, breakpoint constants, z-index scale, focus-ring **geometry**. Values, not roles.                    |
| **Semantic**   | global `:root` (the editorial default mapping)    | the **generic role tokens components read** — `--surface`, `--text`, `--primary`, `--font-body`, `--space-block`, `--radius-card`, `--motion-fast`, etc. — mapped from the primitives. The editorial look **is** this default mapping at `:root`. |
| **Brand**      | the project's interactive slot (`[data-project]`) | a **full scoped override** of the semantic layer for one slot — color, font, spacing, type-scale, motion, radius, border, shadow, density — driven by the OKLCH engine from the slot's `brandColor` (incl. focus-ring _color_ and status colors). |

The model is layered, not partitioned: the **semantic layer is the contract** components code
against, and a project slot simply re-defines those same semantic tokens with its own values. There
is **no separate "feel" or "geometry" tier** — radius, border, shadow, and density are just more
semantic tokens, and a slot overrides as many or as few of them as it differs on. What varies per
project is therefore open-ended (any semantic token), not a fixed subset.

A project's page chrome (title, prose, nav) reads the **semantic tokens at their global editorial
defaults**. Its **interactive slot** and the components embedded inside it read the **same generic
semantic tokens**, but resolved to the slot's brand values because the `[data-project]` scope
re-defines them. Components never read a project-prefixed name — there are **no `--<proj>-*`
tokens**. Two projects on one page reuse the identical generic token names; the cascade resolves
each to the nearest `[data-project]` scope. A slot's engine ramp lives as slot-scoped primitives
with generic names (`--ramp-1..12`), which the slot's semantic tokens are mapped from.

```
global :root  (foundation primitives + the semantic editorial defaults)
   ├─ FOUNDATION: neutral B/W/gray ramp · Newsreader · spacing ramp · motion curves
   │              · type-scale ratios · breakpoint constants · z-index · focus-ring GEOMETRY · reset
   ├─ SEMANTIC (editorial default mapping): --surface · --text · --primary · --font-body
   │              · --space-block · --radius-card · --motion-fast · …  ← the generic contract
   └─ @layer foundation, semantic, brand, project;   ← bare order statement, loaded first
          │ every page's chrome (nav · headers · prose) reads the semantic tokens at their defaults ↓
   home · about · /now · the project page AROUND the slot   — all editorial, no brand
          │ and inside a project page, one bounded slot re-defines the semantic tokens ↓
[data-project="<slug>"]   the project's interactive slot — a FULL semantic override
   ├─ --ramp-1..12   ◄── OKLCH engine ◄── this project's brandColor (from Sanity)
   ├─ --surface / --text / --primary / … re-mapped from the slot ramp (brand values)
   ├─ status colors  ◄── canonical hue (success/warning/error/info), brand-*treated* by the engine
   ├─ --font-body    ◄── resolved face's .variable class
   └─ radius / border / shadow / density / motion — overridden only where the slot differs
          │ themes downward, within the slot ↓
   the slot's experience + embeds   read the SAME generic semantic tokens (--surface, --primary, --font-body, …)
          └─ [data-experience-surface]  optional scoped reset for an interactive surface
```

Key points:

- **The public token contract is the SEMANTIC layer.** Shared, cross-project units read the
  generic role tokens (`--surface`, `--text`, `--primary`, `--font-body`, `--space-*`) — never a
  project-prefixed name, because a shared embed cannot know which project hosts it. Isolation comes
  from **scope, not prefix**: the `[data-project]` boundary re-defines the same generic tokens, and
  the cascade resolves a component to the nearest scope.

- **The editorial look is the global default mapping; brand lives in the slot.** The semantic
  tokens at `:root` map to the editorial primitives (Newsreader + the neutral ramp) — that's house
  style, the default every chrome surface reads. Spacing, motion, breakpoints, and type-ratios are
  themeable-in-principle but invariant-in-practice, so a slot rarely overrides them; the brand ramp
  and font, by contrast, genuinely vary per slot and must be flash-free, so they live in the slot
  scope. A slot overriding a semantic token is still downward theming via normal cascade.

- **Every CSS Module must declare its `@layer`.** Next does **not** auto-assign CSS Modules to a
  cascade layer, and an _unlayered_ module's plain declarations outrank **every** `@layer` style
  regardless of specificity or source order. So any component CSS Module that sets real properties
  must wrap its body in `@layer project { … }` (or stay strictly var-_consuming_); the engine's
  scoped `<style>` declares `@layer brand`; the bare `@layer foundation, semantic, brand, project;`
  order statement is emitted in a global sheet loaded first. Lint-enforced (see the don't-reach-up
  litmus).

- **Cascade order via `@layer`** (foundation < semantic < brand < project) to kill CSS-module insertion-order
  accidents instead of fighting specificity. The global order statement must register before
  `next/font` — pinned by import order in the root layout.

- **Breakpoints are not `:root` custom properties.** CSS variables are invalid inside `@media`
  conditions, so breakpoints are build-time constants / container queries; custom props can still
  feed JS. Slot-responsive layout uses container queries scoped to the slot.

### The OKLCH engine

The engine is the load-bearing, genuinely hard piece of the system — not a lightness ramp but a
small color _system_. It is **both a feature and a project — same logic, two-plus consumers.**

- A **pure function**: takes a brand color **and a scheme**, emits a color-token set. Knows
  nothing about projects. Lives in its own workspace package (`packages/oklch`, imported as
  `@garden/oklch`) — no React, no DOM, no Node built-ins — as the single source of truth
  for the algorithm. Its isomorphism is **enforced**, not hoped: a lint import-boundary on the
  package forbids `next/*`, `react`, `react-dom`, and DOM/Node globals, and a dual-environment
  test runs the suite under both `node` and `jsdom`. (Do **not** use `server-only`/`client-only` —
  those pin it to one side and break the requirement.)

- **Scheme-aware.** The signature is `(brandColor, scheme) → tokenSet`. One `brandColor`
  per project generates **both** light and dark ramps — dark is reduced chroma + shifted surface L
  with on-color contrast re-solved, not "invert L." The scoped `<style>` emits both via CSS
  `light-dark()` so a single block carries both schemes and switching is pure CSS, respecting
  `prefers-color-scheme`. A seed too light to serve as the light-mode primary is auto-assigned as
  the **dark-mode** brand, with the light-mode brand derived from it.

- **Contrast is solved, not stepped.** OKLCH `L` is perceptual lightness, _not_ WCAG
  relative luminance or APCA Lc — a fixed ΔL passes for a blue brand and fails for yellow/cyan at
  the same steps. The engine takes a contrast target (APCA Lc for text, WCAG 2.x as compliance
  fallback) and binary-searches `L` for on-brand/on-surface pairs against the relevant background.

- **Gamut-map before contrast math.** OKLCH chroma routinely exceeds sRGB and even P3; the
  engine cusp-maps (Ottosson-style chroma reduction toward the boundary) to the chosen target
  gamut (P3 vs sRGB, chosen explicitly) _before_ computing contrast, so the math is done against
  the color the screen actually shows.

- **Bakes literal `oklch()` values server-side.** The engine emits resolved, gamut-mapped,
  contrast-solved literals — not relative-color CSS. Live per-token CSS override is explicitly
  **not** a goal: no consumer needs the cascade to re-derive a mid-chain token (the playground and
  card swatches re-run the pure function in JS). Relative-color (`oklch(from …)`) is permitted only
  for decorative, non-contrast deltas. This is also what makes server-side validation possible.

- **Focus-ring _color_ is an engine token**; only its geometry is part of the global foundation. The
  global reset is kept free of other smuggled looks (`::selection`, `accent-color`, default link
  color) — those belong in the scoped tier.

- **Status colors are canonical-hue, brand-harmonized.** `success`/`warning`/`error`/`info` use
  **fixed canonical hues** (green / amber / red / blue), so they stay recognizable — error is red, a
  usability requirement, not a brand-shifted guess. They are **not** derived from the brand hue. What
  harmonizes them with the slot is the **treatment**: each is contrast-solved, gamut-mapped, and
  re-solved per scheme through the same pipeline as the rest of the ramp (and against the slot's own
  brand-tinted worst-case surface). They're part of the engine's designed output; the deeper
  brand-lean rules are a deferred follow-up (see the GitHub issue tracker).

- **Defensive, never throws.** `brandColor` comes from an editor and may be invalid or
  out-of-gamut. The engine parses/clamps/gamut-validates and **returns a safe fallback palette**
  rather than throwing — a bad color is expected data, not an exceptional bug. This pairs with
  author-time Sanity validation (see the content model) and a `ProjectScope` backstop (the content
  model and repo & hosting sections).

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
  case), plain inline is already flush-before-paint.

- The **slot scope re-maps** the generated ramp into the semantic tokens (`--surface`, `--primary`,
  `--font-body`, …); the engine emits the ramp primitives, the scope does the role mapping — not the
  engine.

**Three consumers, one engine:**

- **Consumer A — the theming feature**: the per-slot theming layer (`ProjectScope`) calls the
  engine on the server to emit each slot's `<style>` block.
- **Consumer B — the portfolio piece**: `src/projects/oklch-engine/` is an ordinary project module
  (a project module like any other) whose interactive experience is a playground (drag a hue, watch
  the palette regenerate). The experience **imports the same shared engine** — it never reimplements
  it, and re-runs the pure function in JS on each slider move (it does not rely on CSS re-derivation).
- **Consumer C — preview swatches**: the index (and inline previews) call a
  `cardSwatches(brandColor)` helper that runs the **same engine** and returns just a few stops. The
  card sets them as inline `--c-*` custom properties on otherwise-editorial chrome — no slot scope,
  no `<style>` block, no full override. It goes through the same parse/validate path as everything
  else.

Two deliberate consequences:

- **It themes itself, on purpose.** The oklch-engine project's slot is themed like any other, so
  its own brand tokens are generated by the engine it showcases. No circular dependency in code
  (the project depends on the engine; the engine depends on nothing).
- **Keep it isomorphic** (enforced — see above).

The anti-pattern to avoid: putting the engine _inside_ a project module and having the theming
layer reach up into a portfolio piece for infrastructure — that inverts the dependency direction.
Shared logic lives in a shared module; the project is a presentation of it.

### Downward theming

The **project's slot scope is the single downward-theming owner** for brand: it re-defines the
semantic tokens with the project's brand values (from the OKLCH engine) plus any other semantic
overrides, and themes everything beneath it — the slot's interactive experience and the components
it embeds — by passing those values _down_. They all read the same generic semantic tokens; the
slot scope is the authority. The page chrome around the slot reads the semantic tokens at their
editorial defaults; the foundation primitives sit above, shared.

The directional rule:

- **Host themes the child downward** by setting the semantic tokens the child consumes. Fine.
- **Child reaching up** for an ancestor's _brand_ value. Banned.
- **Reading the global _foundation_ primitives** (spacing, motion). Allowed — it's shared plumbing,
  not a look.

The override surface is precise: you override the **seed** (re-run the engine, server-side, per
scope) **or** a **leaf consumable token** (`--primary`, `--font-body` — a literal a host sets and a
component reads). You never override a _mid-chain derived_ token and expect its derivatives to
recompute — the engine baked them. The `var(--public, var(--_internal-default))` pattern is for
composition-time downward theming of primitives, not live ramp re-derivation.

Self-sufficiency still applies _within_ the slot: a shared primitive must not assume tokens from
any _specific_ project's scope. It ships its own defaults and reads generic semantic names
(`--surface`, `--primary`, `--font-body`), so it works composed into any project (or none).

---

## Project modules

### Structure

```
src/projects/<slug>/
  ├─ pages/             the project's own page components — essay / hero / other
  ├─ experience.tsx     the interactive experience (the working demo); a thin page mounts it
  ├─ core/              headless core — ONLY when the experience's logic earns extraction
  ├─ embeds.ts          project-local embed map (key → component) — bespoke inline embeds
  ├─ tokens.css         the project's slot-scoped semantic override (generic names, brand values)
  └─ index.ts           registry entry
src/fonts/roster.ts        curated next/font declarations, one per face, exported by key
src/lib/resolvers/embeds.ts      embedKey → embed-component loader — cross-project widgets
src/lib/resolvers/components.ts  componentKey → () => import("@/projects/<slug>")  [literal imports]
src/*/keys.ts              string-constant key contracts (Studio imports these; resolvers don't)
```

A project is **one or more pages**. The interactive experience is the only constant; beyond it a
project may have an essay/rich-media page, a hero, something else, or nothing more at all — the
page set is decided per project, not fixed by a template. `experience.tsx` is the component; a thin
page in `pages/` mounts it. A headless `core/` is **not** templated into every module — let it
emerge only when an experience's logic warrants extraction (same deferral discipline as the
embed tiers; see the interactive experience section). The module owns its page components; thin
route files mount them. Code lives under `src/projects/<slug>/`; **routes are flat** — `/` is the
**featured** front door, a browsable **Index** lists every entry, and a root-level `/[slug]` (a
dynamic segment that cedes precedence to static segments like `/about`, `/now`, and the Index) mounts
any entry's pages. Every entry — note, essay, or project — lives at a **flat top-level slug**
(`/some-note`, not `/notes/some-note`), so its URL stays stable even if its `kind` changes. There is
no `/work` prefix.

**Start single-tier** — one shared `src/lib/resolvers/embeds.ts` until a second project actually reuses a
widget; introduce the project-local tier only then. Once you do, embeds follow the **same
per-project-plus-shared shape as tokens and fonts**. For a given project the resolver composes the
two (`{ ...shared, ...projectLocal }`) so a project-local key **overrides** a shared one of the same
name — the downward-override spirit of `var(--public-override, var(--_internal-default))`. A
_shared_ embed themes off the **generic semantic tokens** (`--surface`, `--primary`, `--font-body`),
never anything project-specific. Promote a widget into the shared registry only once it's genuinely
reused; both tiers lazy-import.

Most UI belongs to its project module; lift a primitive into a shared `src/` module only once it's
genuinely reused across projects — not preemptively. A project may also _consume_ shared logic
without owning it — the oklch-engine project's experience imports the shared engine rather than
holding it (see the OKLCH engine).

### The CMS ↔ code registry

```
Sanity entry doc { kind, componentKey: "<slug>", brandColor, fontKey, body, stage, iterated, related, featuredRank, tags }
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
- **Keys are a contract with no referential integrity — guard the seam.** `keys.ts` is the
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
  bundler static analysis). Server Components are auto-split already; the manual lazy import
  buys conditional inclusion, and the real client-bundle savings come from the Client Components
  _inside_ each module.

### The interactive experience: logic in a headless core (when it earns one)

Each project's interactive experience is a demo that actually works. As a general engineering
practice — not for any packaging or reuse goal — its logic _can_ live in a **headless core** (hooks
/ pure functions — state machines, reducers, derivations), with presentation as separate primitives
the experience composes. That split is internal hygiene only, and it is **not mandatory**: a
toggle/slider demo doesn't need a state machine in a separate folder. Extract a `core/` when the
logic warrants it.

There's no demo-vs-experience boundary to maintain. The experience owns its own state and renders
directly. The same interactive experience — or smaller bespoke live components — can be **embedded
inline in an essay** by key, in place of screenshots (see the content model), under the same project
scope, so it themes identically.

---

## Fonts

**Store-the-key (roster-by-key).** A curated roster of faces is declared in code (each a `next/font`
export, in a single shared module); Sanity stores a `fontKey` per project and the editor picks from
a dropdown; the project's **slot scope** applies the face that key resolves to, via that face's
**`.variable` class** on the `[data-project]` wrapper, with the slot's `--font-body` mapping to it;
page chrome stays on the editorial face. This keeps
`next/font`'s self-hosting, subsetting, and zero-CLS sizing while putting a project's type choice on
its document alongside its brand color.

`next/font` must be called at module scope, so the roster can't be _arbitrary_: an editor picks from
the curated set, never a free-text name or upload. **Adding a face to the roster is a code change;
choosing among existing faces is content.**

Two facts make a large roster cheap:

1. **Declaration ≠ download.** Calling `next/font` emits an `@font-face` + a CSS variable; the
   browser only fetches a font file when rendered text uses that family. Declaring fifty fonts costs
   zero downloads on a page that uses none of them.
2. **Preload is build-time static analysis — and `fontKey` is a runtime index.** `next/font`
   injects `<link rel=preload>` for a face it can _statically_ see a route reference. Because the
   roster resolves `fontKey` (a Sanity string) → face at **runtime**, Next cannot target the
   resolved per-project face for preload. This is **not** an SSG-vs-dynamic question (that
   route-level toggle is gone under Next 16 `cacheComponents`; see repo & hosting) — it's a
   build-time-static-analyzability question, independent of caching.

So, the policy:

- **`preload: false` on every roster face** by default (the default is `true`, so this must be set
  explicitly). Only the **1–2 editorial faces** get `preload: true`, in the root layout, where they
  preload on every route.
- **Per-project faces are applied, not preloaded.** A project's slot face (behind a `/[slug]` click)
  tolerates `font-display: swap`. If a specific above-the-fold project face genuinely must preload,
  emit the `<link rel="preload" as="font" crossorigin>` manually.
- **Verify empirically:** `pnpm build`, visit `/[slug]`, view-source the `<head>`, count
  `<link rel="preload" as="font">` — confirm the policy holds (expect the editorial face only).
- **Where the link lands** (initial shell vs streamed hole) is the other axis: keep `ProjectScope`
  in the prerendered shell (see repo & hosting) so its `<head>` contributions are in the initial
  static HTML.

Mapped onto the layers:

- **The editorial face** (the site's global identity — Newsreader) → root layout, `preload: true`.
  Every page's chrome uses it. Keep to 1–2 faces.
- **Per-project fonts** → resolved from the project doc's `fontKey` against the code-side roster,
  applied at the project's `[data-project]` **slot** scope via `.variable` — they theme the slot,
  not the page.
- **Shared fonts** → the roster _is_ the single declaration point, so a face two projects use is
  declared **once** and resolved by both.
- **Experience & embed fonts** → neither declares its own `next/font`; each reads the generic
  `--font-body` token, which the slot fills from the resolved face.

Practical notes:

- Prefer **variable fonts** (one file, many weights/optical sizes).
- The site is **flash-free for _theming_** (color arrives inline with the markup); fonts are
  **zero-CLS with an intentional `swap`** — next/font's size-adjusted fallback kills layout shift but
  a per-project slot face will visibly swap as its slot mounts, by design. Decide `swap` vs
  `optional` per face.

---

## Content model (Sanity)

- **Content lives in Sanity; interaction lives in code.** An `entry` document holds the content and
  references a coded module via `componentKey`; the CMS never reimplements interaction.
- **One document type — `entry`; a `kind` field discriminates.** Notes, essays, projects, and
  now-updates are the same shape — a themed page with one or more interactive slots plus prose — so they
  are **one document type**, not several separate types and not a schema-merge that erased the
  distinction. A **`kind`** field (`note` · `essay` · `project` · `now`) carries the distinction as
  _data_: it drives the Index's type filter and the on-card label, so the difference is legible without
  being a `_type` split. The kinds differ by **scope and emphasis, not fields** — a _note_ is a small,
  often single-component piece (and doubles as a shareable social post); an _essay_ is writing-led with
  interactions slotted in; a _project_ is an interactive experience with more slots; a _now_ is a dated
  "now" update (à la a `/now` stream) that can mix into the Index (the Sanity-driven `/now` + Index
  wiring is #60). `brandColor` and `componentKey` are **conditionally required for a `project`** and
  optional for the other kinds; `stage` does not apply to a `now`. A second document type is deferred
  until a kind genuinely proves divergent fields.
- **`stage` is maturity; `iterated` is freshness.** **`stage`** (sketch → prototype → shipped —
  stable stored values, labels re-wordable in the UI) is the honesty badge on every entry, independent
  of scope (`kind`) and of curation (`featuredRank`). **`iterated`** is an _authored_ "last worked on"
  date — not Sanity's automatic `_updatedAt` — an intentional signal that the portfolio is living and
  tended.
- **The essay is rich content (portable text), not plain text.** Alongside text it carries typed
  embed blocks — media and live components referenced by key and resolved in code.
- **`brandColor` is per-project, typed, and validated.** It's a field on the `project`
  document (the slot seed), stored as a validated string (hex or `oklch()`). Author-time Sanity
  `validation` runs the engine's own color pipeline (parse → gamut-map → confirm in-spec contrast)
  for editor feedback. Defense-in-depth: the engine itself never throws (see the OKLCH engine) and
  `ProjectScope` falls back to a safe default. `siteSettings` holds the site title/description and
  may seed a homepage slot; it does not brand the chrome.
- **`fontKey` is per-project** — a field on the `project` document, chosen from the curated roster
  (see fonts). Reference-by-key, exactly like `componentKey` and `brandColor`.
- **No per-scheme color field.** Dark mode is a render-time axis; one `brandColor` generates
  both schemes. A project needing a hand-tuned dark brand gets an _optional_ `brandColorDark`
  override, defaulted from the engine — never a required parallel field. (A seed too light to be the
  light-mode primary is auto-assigned as the dark brand; see the OKLCH engine.)
- **Keys are a contract; the Studio never imports implementations.** Each reference-by-key
  pair is split: a tiny `keys.ts` of string constants (imported by the schema to build its dropdown)
  and a separate resolver in the app — `lib/resolvers/components.ts`, `lib/resolvers/fonts.ts`,
  `lib/resolvers/embeds.ts` — which the Studio never imports. This keeps `next/font` and lazy project
  bundles out of the Studio bundle. With the **standalone Studio** this separation is
  structural (different workspace package), so `keys.ts` lives in a shared workspace package both
  consume rather than being duplicated. See the CMS ↔ code registry for the typed-resolver +
  fallback discipline that makes the soft foreign key safe.
- **Embeds: generic `liveEmbed` by default; a typed block only for editorial content.** A
  `liveEmbed` block stores an `embedKey` + a caption — use it whenever the only authored inputs are
  key + caption (the demo and the majority of in-essay embeds; adding one is zero schema change).
  Give a widget its **own typed block only when an editor must author structured _content_** (text
  they write, an image they pick, a list they curate). **Never** model code-level config (variants,
  sizes, initial state) as a block or an untyped `props` blob — default it in the registry, or split
  into two registered keys. Litmus: _editor writes/curates it → typed block; developer decides it →
  registry; neither → it's not an input._
- **The index query refuses to over-fetch.** The card query pulls `blurb`, `brandColor`, `fontKey`,
  `kind`, `stage`, `featuredRank` — **not** the body. That enforces "a few colors per card" at the data
  layer (cards feed `cardSwatches` — the OKLCH engine's Consumer C) and keeps the index payload small
  for CWV.
- **`ProjectScope` is the resolution keystone.** One server component takes a scope's `brandColor` +
  `fontKey` and emits the flash-free scoped `<style>` (engine palette, both schemes via
  `light-dark()`) plus the resolved font's `.variable` class. It wraps a project's **interactive
  slot** (and any homepage slot `siteSettings` seeds), not the page chrome. It is
  **defensive** — engine returns a fallback on bad input, and the component is wrapped in
  `unstable_catchError` (`next/error`) as a backstop, **not** a segment `error.tsx` (which doesn't
  catch its own layout's throw — see repo & hosting). It renders in the prerendered shell; the slot's
  subtree reads the slot's brand-valued semantic tokens (`var(--surface)` / `var(--primary)` / `var(--font-body)`).
- **Visual editing details.** Disable Sanity **stega** on `brandColor`/`fontKey` — the
  invisible encoding chars break the OKLCH parse and the font-class lookup. `liveEmbed`
  click-to-edit targets the caption/`embedKey` field, not the interactive region.
- **Backlinks are Day-1.** An `entry` carries a `related` **self-referencing** array (`entry` →
  `entry`) — **real Sanity `reference` fields**, not free-text slugs (or `references()` finds nothing
  and you reintroduce key-drift) — and the read path resolves **incoming** backlinks via GROQ
  `references()`, so an edge authored once shows on both ends. Because there is one type, the graph is
  cross-kind for free: a project links a note links an essay. A note stays lightweight (chrome + shared
  components) and pulls a demo bundle only if it explicitly embeds one.
- **Two reading paths over one content graph.** The **featured home** (`/`) is a curated front door —
  the entries with a `featuredRank`, of _any_ `kind`, ordered by rank — for a hurried evaluator. The
  **Index** is the full browsable list of every entry, filtered by `kind` and `stage` and wired with
  backlinks, for the wanderer. The portfolio is a _view_ of the graph (a saved `featuredRank != null`
  filter), not a separate section. Both, plus `/about` and `/now`, are shell-owned and wear the global
  editorial look (see the token & theming architecture).
- **TypeGen + `defineQuery`**: typed GROQ; run TypeGen after any schema or query change (a committed
  script + a CI `git diff --exit-code` on the generated types keeps it from rotting); `defineQuery`
  must wrap the query literally (no runtime interpolation).

---

## Repo & hosting

- **Stack.** Next.js 16 (App Router, Turbopack default), React 19, Sanity, Vercel. Request APIs are
  async; the renamed `proxy.ts` replaces `middleware.ts` (Node-runtime only — no `edge`). **Styling
  is CSS custom properties only** — no JSON tokens, no Tailwind, no Style Dictionary; the OKLCH
  engine emits CSS vars directly.
- **Cache Components enabled app-wide.** `export const dynamic`/`force-static` are gone — all
  routes are dynamic-by-default with PPR baked in, and static-vs-dynamic is a **component-level**
  concern (`use cache` + where request-time APIs are touched). A route is a **prerendered shell with
  dynamic holes**. `ProjectScope` (wrapping a project's slot) renders into the prerendered shell so the scoped theme
  `<style>` and the resolved font class are in the **initial static HTML** (flash-free, no streamed
  delay), while the essay streams. This is an app-wide rendering model (request APIs need Suspense or
  arg-passing; `<Activity>`-based state preservation across nav).
- **Error containment is a defensive-engine job, not an error boundary.** A throw in a Server
  Component bubbles to the nearest _parent_ boundary, and a segment's own `error.tsx` does **not**
  catch a throw from that segment's _layout_ — and `ProjectScope` is a layout-level wrapper. So
  containment is: engine returns a fallback (never throws) + `unstable_catchError` around
  `ProjectScope`. A caught error would also render _unthemed_, the wrong response to a data-quality
  problem — hence "validate + fall back," not "let it throw and catch."
- **One Next.js app for the site; the Sanity Studio is a separate workspace package.** The
  repo is a multi-member pnpm workspace: the Next app at the root, a **standalone Sanity Studio in
  `studio/`** (Vite-based, auto-updating, TypeGen watch mode), and the `@garden/oklch` engine in
  `packages/oklch`. The _site_ is still a single app with
  no project sub-packages — project code lives under `src/projects/*`; shared bits live in shared
  `src/` modules. Boundaries are **lint-import rules**: a project can't import another project;
  shared can't import a project; plus the `packages/oklch/**` isomorphism boundary (see the OKLCH
  engine) and the every-CSS-module-declares-its-`@layer` rule (see the token & theming architecture).
- The site runs on **Vercel** with full SSR / RSC. This unlocks server-rendered flash-free per-scope
  OKLCH `<style>` blocks, Sanity draft mode / visual editing, an RSS route handler, a `/now` page,
  and the prerendered-shell-with-streaming model above.

---

## "Don't reach up" litmus (quick reference)

Before shipping a **shared** unit (the litmus is for shared primitives, not every component):

- [ ] Does it render correctly reading only **generic semantic tokens** (`--surface`, `--text`,
      `--primary`, `--font-body`, `--space-*`) plus its own defaults — with no dependency on any
      project-specific token name?
- [ ] Is every themeable value exposed as a **public token** with an internal default?
- [ ] Does it avoid assuming any **themeable ambient context** (a parent's _brand_ value, a
      font mounted higher up)? Reading the global **foundation** primitives (spacing, motion) is fine —
      that's plumbing, not a look.
- [ ] If shared, is it **declared once and composed in**, never re-instantiated per slot?
- [ ] Does the host theme it **downward** (set the semantic tokens it consumes) rather than the unit
      reaching up?
- [ ] If it has a CSS Module, does that module **declare its `@layer`** (or stay strictly
      var-consuming)?
- [ ] If it registers an embed, is the key **namespaced with the project's prefix** so a
      project-local embed can't silently shadow a shared one?

The litmus is an **advisory** PR checklist for shared primitives; the parts that can be a lint rule
(import boundaries, `@layer` declaration) are enforced automatically, not left to human review.
