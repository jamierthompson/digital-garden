# Architecture — system model

The system model for the portfolio + digital garden. Each entry is a **self-contained
module** — its `/[slug]` page (the editorial article plus its interactive slot), the
slot components its essay mounts, and its tokens — composed within the site.
Hosted on Vercel; essay + theme seeds in Sanity.

This is the **reference for how the system is designed**; code and the other docs point back to
its sections by name. This document is the current truth; it is edited in place as the system
evolves, and git history is the audit trail — there is no separate decision log to reconcile
against. Where any doc and the framework disagree, **the bundled Next docs win**
(`node_modules/next/dist/docs/`) — your training data is stale on this stack.

---

## Guiding principles

These are the through-lines; everything else follows from them.

- **Modules, not a monolith.** The thing to avoid is a single fused bundle with no internal
  seams. Each entry is a self-contained module — its tokens, UI, pages, and interactive
  slot — that the site's routes load. Genuinely shared parts (token recipes, the OKLCH
  engine, the odd reused primitive) live in plain shared modules. No fused bundle; no premature
  abstraction either.

- **The routing layer stays thin.** `src/app/` holds only Next.js route files (`page` / `layout` /
  `route` / … per the App Router file conventions) plus what co-locates with them — their
  `*.test.*`, the private helpers a route file imports (a `route.ts` can't export non-handlers, so
  RSS's `escapeXml.ts` lives beside it), `*.module.css`, and static assets.
  Real logic and shared components live in `src/` modules; design-system CSS in `src/styles/`. The
  routes wire things together and mount from the source tree — they don't hold the logic. Enforced by
  `pnpm lint:routes` (`scripts/check-app-routes.mjs`), so the drift that manual review kept missing
  can't recur. The guard is **deliberately stricter than Next**: Next blesses `_private` folders for
  co-locating components under `app/`, but here components/logic belong in `src/`, so a module in
  `app/_components/` is still flagged.

- **Composition over inheritance.** Every page wears an **authored theme** — its own seed when one
  is authored, else the site default (`siteSettings.theme`, #253): the resolved theme color runs
  through the OKLCH engine and is stamped on `<html>`, so all chrome +
  prose + slots wear it. The global typography is fixed house style — Space Grotesk headings +
  Source Serif 4 body — and a **themed entry** (any kind but a `now` update) additionally carries its
  **own theme fonts** — up to three optional faces (heading / body / mono) — scoped to its
  **interactive slot(s)** (the `Slot` / `[data-entry]` wrapper, or each interleaved slot's
  container), where each resolved face re-binds its role token (`--font-heading` / `--font-body` /
  `--font-mono`) for the slot and an unset role simply inherits the site face. The `:root`
  semantic color tokens are just the engine's baked **fallback** for surfaces that render un-themed. Entries
  are not variations of one global _look_; they are self-assembled from shared parts.

- **Self-sufficient contracts; theme downward; never reach up _for a look_.** Every unit — a
  token group, a component, an entry module — ships its own defaults and is themed by whatever
  composes it _downward_. Nothing depends on **themeable** ambient context (a theme value) provided
  by an ancestor it doesn't own. It _may_ depend on the global **foundation** layer (spacing,
  motion, z-index) — that's shared plumbing, not a look. This is the precise form of
  "don't reach up the tree," and it generalizes the `var(--public-override, var(--_internal-default))`
  pattern from leaf primitives across the system — but as **composition-time** theming (a host sets
  the tokens a child reads), not runtime re-derivation of an engine's computed ramp.

- **Right-sized, not maximal.** This is one app with a handful of entries, not a set of
  shippable packages. Slot-scoped theming, downward theming, and the don't-reach-up discipline stay
  only where they earn their keep. The foundation and the semantic defaults are shared globally (the
  engine's baked fallback for un-themed surfaces); a page's authored **color** theme rides on `<html>`, and
  only the **theme fonts** are scoped to each themed entry's slot. A small foundation _coordination_ layer is the norm (see
  the token & theming architecture below), the slot registry starts single-tier (see entry
  modules), and the don't-reach-up litmus applies to shared primitives, not every component.
  Concentrate the sophistication where it pays — the OKLCH engine (the load-bearing, genuinely hard
  piece), the content model, performance — and let the rest be boringly simple.

---

## Code vs content

Two homes:

- **The Next app** — all code: each entry's pages, its interactive slot (a working
  demo), and the slot components its essay mounts. Each entry is a self-contained module under
  `src/entries/<slug>/`; shared parts live in plain shared modules.
- **Sanity** — content & theme seeds: one `entry` document type covering every content kind — a
  `kind` discriminator (note · essay · demo · now), a Portable Text body (rich text with inline slots),
  a `stage` (sketch → prototype → shipped), an authored `iterated` date, self-referencing `related`
  backlinks, an optional `featuredRank`, the per-entry `theme` object (`color` / `colorDark` /
  `headingFont` / `bodyFont` / `monoFont`), and the top-level `componentKey` — all reference-by-key seeds.

Within an entry the division is code vs content, but the line isn't a wall. The interactive
slot and the components are code; the essay is content. The essay is _rich_, though — it
can mount media and live components as inline slots (including the demo itself, in place of screenshots) by key —
per-entry or shared, the same reference-by-key move as `componentKey` (see entry modules and
the content model). The slot's logic lives in a headless core when it earns one (see the
interactive slot section), but that's ordinary code organization, not a boundary the site has
to maintain.

The shell's top-level pages — the featured home, the browsable Index, about, `/now`, and `/system` —
are owned by the site rather than any entry, and wear an authored theme like every other page —
seeded from their `siteSettings.pageThemes` override, or the site default (`siteSettings.theme`)
when none is authored (see the token & theming architecture).

---

## Token & theming architecture

### Two tiers + a theme override: foundation (primitives) → semantic (role tokens)

Tokens are organized in **two tiers** — the semantic tier consuming the foundation — plus a **theme** that re-binds the semantic tier per scope (not a third tier of token names; there are no `--theme-*` names):

| Tier                   | Lives at                                          | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Foundation**         | global `:root`                                    | the raw dimensional primitives + the reset: the spacing ramp, the content-grid lane widths (`--width-content` 42rem — the prose lane IS the site's one reading measure, ~66ch of the body serif / `--width-wide` 80rem, the breakout lane), the radius knob (`--radius-base` 4px — the one corner-personality dial; the semantic roles derive from it), border widths (`--border-width` 1px / `--border-width-thick` 2px), control sizes (`--size-control` 24px / `--size-control-lg` 44px / `--size-icon` 16px), motion curves/durations, the engine-derived type-size ramp (`--type-size-*`), weight/tracking/leading families, z-index scale, focus-ring **geometry**. Values, not roles — and NOT color (color is derived, never a hand-authored ramp). |
| **Semantic**           | global `:root` (the baked engine fallback)        | the **generic role tokens components read** — `--surface`, `--foreground`, `--muted` (a faint neutral background) / `--muted-foreground`, `--icon` (the neutral graphic ink, solved at the non-text 3:1 tier), `--accent` + `--accent-subtle` / `--accent-subtle-foreground` (a soft accent-tinted surface + its label, symmetric with the `<status>-subtle` pairs), `--font-body`, etc. At `:root` these are the engine's own **fallback** token set (`buildTokenSet(undefined)`) baked as `light-dark()` literals — the fallback ground for surfaces that render with no `<html>` theme.                                                                                                                                                                  |
| **Theme** _(override)_ | `<html>` (color) + the slot `[data-entry]` (font) | re-binds the semantic tier, applied two ways: an entry's authored **color** is written imperatively on `<html>` (`PageTheme`) — the full contrast-solved semantic set incl. status — and inherited by chrome + slot alike; its **fonts** are per-slot role-token overrides (up to three — `--font-heading` / `--font-body` / `--font-mono`) on `[data-entry]` (`EntryScope`), each inherited from `:root` when unset.                                                                                                                                                                                                                                                                                                                                       |

The model is a **derivation taxonomy, not a partition**: the **semantic tier is the contract**
components code against, and a theme simply re-defines those same semantic tokens with its own
values — the page's `<html>` write for color, the slot's inline style for font. There is **no
separate "feel" or "geometry" tier** — radius, border-width, and control sizes are **foundation value
primitives** (raw scales like the spacing ramp), and any role that needs one binds it in the semantic
tier, exactly as the spacing roles alias `--space-*`. The dimension roles components read: the
space roles (`--space-inset/-gutter/-stack/-cluster/-grid/-flow/-caption/-section`), the radius
roles (`--radius-control/-surface/-pill`, derived from the `--radius-base` knob and re-declared at
the slot scope so a theme can re-bind them), and the per-role measure caps
(`--type-<role>-measure`, provisional hand values until the type engine computes them). A genuinely
component-specific value is bound as a **component token** — the third tier under the semantic
roles, and the one sanctioned place a module reads the raw scale (`pnpm lint:dimension`). The
convention: a component token is declared in a **labeled block on the component's root rule**,
**named for the design job it does** (`--quote-indent`, `--demo-sidebar-basis`,
`--scrollbar-thumb`) — a single consumer is fine (Material's `md.comp.*` tier is mostly
single-consumer; the name is the point). It is **never minted in a route module** (a route element
needing its own designed geometry is a component asking to be extracted), never as a same-line
alias whose only job is passing the lint, and it is **promoted to a semantic role the moment a
second component needs the same job** (how `--space-flow`/`--space-caption` were born). Color varies per **page** (every route wears
its authored theme); font varies per **slot** (the interactive island wears the entry's theme face
while the prose keeps the editorial body face).

**Token tiers are not cascade `@layer`s — keep the two systems apart.** The two tiers above
(foundation → semantic, re-bound per scope by a theme) are a _derivation taxonomy_: where a value comes from, expressed by
the **directories** (`foundation/`, `semantic/`) and the **engines**, not by any cascade name. The
CSS cascade `@layer` is an unrelated _rule-conflict tool_ with exactly **two** names chosen for their
jobs: `base` (the reset + every token sheet) **loses** to `components` (every CSS Module). That one
boundary is all the cascade decides — a global element/attribute rule must lose to a component rule
regardless of CSS-module insertion order. The retired `foundation`/`semantic` _layer_ names were
taxonomy wearing cascade clothing: the two sheets declare disjoint `:root` custom properties, so that
boundary never resolved a real conflict, and collapsing them to `base` changes no computed style.
**Theme delivery sits outside the cascade entirely** — an authored theme is stamped as inline
`<html>` / `[data-entry]` styles plus a hoisted _unlayered_ `<style>`, all of which out-rank **every**
`@layer` (the "@layer trap"), so a theme always wins without needing a layer of its own.

Every page's chrome (title, prose, nav) reads the **semantic tokens as written on `<html>`** by the
visible page's theme. Its **interactive slot** and the components it mounts read those **same generic
semantic tokens** (inherited from `<html>`), plus the entry's `--font-body` re-bound on the
`[data-entry]` scope. Components never read a slug-prefixed name — there are **no `--<slug>-*`
tokens**. Under the hood the engine emits a **per-role `50…950` ramp primitive** (`accent`,
`neutral`, and the four status ramps) and **binds each semantic token to a ramp step** — so
`--foreground` is `neutral`'s smallest step that clears body-text contrast, `--surface` is a fixed
light/dark neutral step, and so on. Consumers still read only the generic semantic names; the ramp
math stays behind them (the raw `--<role>-<step>` steps are also emitted for a consumer that wants
them).

Because every color token is **contrast-solved this way, it is immutable at the point of use**: a
consumer reads it, it never derives a new color from it. Three forms are forbidden — `color-mix()`ing
a token, slash-alpha-fading it (`var(--token) / <alpha>`), and re-deriving it through relative-color
syntax (`oklch(from var(--token) …)`) — because each discards the very contrast the engine solved
for. A lower-emphasis or tinted role is its **own** designed token — `--muted-foreground`, `--muted`,
`--accent-subtle`, the `*-subtle` status families — solved for its own ground, not a runtime
weakening of a stronger one; derivation belongs in the engine, not component CSS. This is a CI gate
(`pnpm lint:color`, `scripts/check-color-immutability.mjs`): it derives the color-token set from
`semantic/color.css` and flags all three forms on any of them, exempting `currentColor` and
non-color vars (spacing, radius, border-width). A missing role is a gap to add to the semantic
contract, never a mutation to reach for.

**Text and graphics are solved at different targets, so they read different roles.** WCAG 2.2
governs text at 4.5:1 (SC 1.4.3) and non-text content — icons, marks, glyphs — at 3:1
(SC 1.4.11, the engine's `ui` tier). The neutral ink ramp runs `--foreground` (Lc 75) →
`--muted-foreground` (60) → `--icon` (45) → `--border` (30). A graphic paints from **`--icon`**,
or from `--foreground` when it wants full strength (same neutral role, higher emphasis — that is
how an icon's hover reads), or from a fill it sits on (`--accent`, `--accent-hover`, a status fill
and its `-foreground` label). It never reads `--muted-foreground` or a `*-text` role: those are
solved for _text_, and de-emphasis for a graphic is `--icon`, not the muted text ink. This is a CI
gate (`pnpm lint:icon`, `scripts/check-icon-roles.mjs`), and it resolves component-token
indirection, so binding a text role to `--my-icon-ink` does not launder it past the check.

```
global :root  (foundation primitives + the semantic ENGINE FALLBACK)
   ├─ FOUNDATION: spacing ramp · content widths · motion curves · type-scale ratios
   │              · z-index · focus-ring GEOMETRY · reset  (no color ramp)
   ├─ SEMANTIC (engine fallback token set): --surface · --foreground · --accent · --font-body · …
   │              ← the generic contract; the fallback ground for surfaces with no <html> theme
   └─ @layer base, components;   ← cascade order statement (base loses to components), loaded first
          │ every ROUTE stamps its authored color theme on <html> (PageTheme), which out-ranks :root ↓
<html style="--surface:… --foreground:… --accent:… --success:…">   ◄── OKLCH engine ◄── the page's seed (Sanity)
   │        chrome (nav · headers · prose · shell) + slots ALL inherit this one write — one imperative
   │        node, so it can't collide across the routes <Activity> keeps mounted at once (#168)
          │ and inside a themed entry, each bounded slot re-binds ONLY its fonts ↓
[data-entry="<slug>" style="--font-heading:… --font-body:… --font-mono:…"]  font slot
   │        per-face leaf overrides stamped in TS by EntryScope, per RESOLVED face. The
   │        --type-<role>-family bundles the type primitives read are declared ONCE in
   │        semantic/type.css under `:root, :where([data-entry])`, so they re-substitute against
   │        these leaves inside the slot. An unset face stamps nothing and inherits :root. A page
   │        mounts one (the demo template's sidebar + canvas surface)
   │        or MANY (slots interleaved through the prose); each is per-element, so distinct slots never
   │        collide. Color is inherited from <html>; only the resolved font roles are overridden here.
          │ themes downward, within the slot ↓
   the interactive slot + interleaved slots   read the SAME generic semantic tokens (--surface, --accent, --font-body, …)
```

Key points:

- **The public token contract is the SEMANTIC layer.** Shared, cross-entry units read the
  generic role tokens (`--surface`, `--foreground`, `--accent`, `--font-body`, `--space-*`) — never a
  slug-prefixed name, because a shared slot cannot know which entry hosts it. Isolation comes
  from **scope, not prefix**: color from the page's `<html>` write (inherited), fonts from the
  `[data-entry]` slot's inline role-token overrides (`--font-heading` / `--font-body` / `--font-mono`).

- **Color themes the page; fonts theme the slot.** Every route stamps its authored color theme on
  `<html>` (`PageTheme`), so all chrome + prose + slots wear it; the `:root` semantic color tokens
  are only the engine's baked **fallback** for surfaces that render un-themed (404 / error / loading). The
  global typography is fixed house style — Space Grotesk headings + Source Serif 4 body + Geist Mono
  mono — and an entry's theme **fonts** (up to three optional faces) override their role tokens
  (`--font-heading` / `--font-body` / `--font-mono`) in the entry's own interactive slot only (inline
  styles on `[data-entry]`; an unset role inherits `:root`), never the page chrome. Spacing, motion,
  and type-ratios are themeable-in-principle but invariant-in-practice.

- **Every CSS Module must declare its `@layer`.** Next does **not** auto-assign CSS Modules to a
  cascade layer, and an _unlayered_ module's plain declarations outrank **every** `@layer` style
  regardless of specificity or source order. So any component CSS Module that sets real properties
  must wrap its body in `@layer components { … }` (or stay strictly var-_consuming_); the bare
  `@layer base, components;` order statement is emitted in a global sheet loaded
  first. The entry font slot needs no layer — the inline role-token overrides on `[data-entry]`
  out-rank every layer. Lint-enforced (see the don't-reach-up litmus).

- **Cascade order via `@layer`** (`base` < `components`) to kill CSS-module insertion-order
  accidents instead of fighting specificity. The token tiers (`foundation/`, `semantic/`) both live in
  the single `base` layer — their split is a directory taxonomy, not a cascade boundary. The global
  order statement must register before `next/font` — pinned by import order in the root layout.

- **Responsive layout is container-query-first.** There is no shared breakpoint layer or breakpoint
  tokens. The order of preference is: **intrinsic** first (`auto-fit`/`auto-fill` + `minmax`, `flex-wrap`,
  `clamp()` — layout that reflows with no query at all, e.g. the browse grid's
  `repeat(auto-fill, minmax(…, 1fr))`); then **container queries** (`container-type: inline-size`
  on a component's own box + `@container`) for component-context responsiveness, the right tool for
  the bounded interactive entry slots — a slot responds to _its own_ width, not the viewport's; and
  **viewport `@media` only for genuine page chrome** whose collapse is a function of the viewport,
  not any container. Write the literal query (`@media (max-width: …)`) — CSS variables are invalid
  inside `@media` conditions, so there is nothing to tokenize.

### Site-wide `<html>` theme delivery (#166)

The engine themes **every page** from an authored seed, applied as a **hoisted `:root` `<style>`**
(re-stamped imperatively on `<html>` on soft nav) rather than a per-slot `[data-entry]` scope. Each page mounts one `<PageTheme seed>` (a synchronous
server component): the site-owned pages (`/`, `/browse`, `/about`, `/now`, `/system`) seed from
their `siteSettings.pageThemes.<key>` override, falling back to the site default
`siteSettings.theme.color` (#253) — both rungs resolved by `sitePageThemeSeed` — and entry pages
(`/[slug]`) seed from `themeSeed` (the kind-gated inner rung over the same site-default fallback). `SiteNav` and `SiteFooter` render once in the root layout above the
pages and **inherit** the page theme (`:root` on hard load, re-stamped on `<html>` on soft nav), so
the persistent chrome wears the visible page's theme with no re-render (inheritance is live).

The mechanism follows Next's _Preventing flash before hydration → Themes_ pattern
(`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`), and mirrors
`src/lib/scheme.ts`'s split (the light/dark axis) — the one difference being that a page's seed is
**author-set and server-known**, so theming carries **no `localStorage`**:

- **The serializer** — `resolveThemeDeclarations(themeColor)` in `src/lib/theme.ts` — is a thin,
  isomorphic wrapper over the engine's `buildTokenSet` + `tokenSetToDeclarations`, returning
  `[property, value]` pairs. It never throws (the engine collapses a bad seed to a fallback).
- **Hard load / refresh (the easy case — the seed is server-known):** the page renders the
  declarations as a `:root { … }` `<style>` (`ThemeStyle`), which React 19 hoists into `<head>` —
  **ahead of the body chrome** — so the theme applies before ANY content paints, with no script and
  no parse-order dependency. This is `EntryCard`'s server-rendered baked-CSS approach lifted to
  `:root`. The `<style>` is **unlayered**, so it out-ranks the `@layer base` fallback `:root`
  (the "@layer trap"). The read path (`sanityFetch`) is `use cache`, so a public request prerenders
  the page into the **static shell** and the `<style>` is in the initial `<head>`. (An inline
  _script_ can't do this — React doesn't hoist inline scripts, so a page-rendered one lands **after**
  the chrome and FOUCs.)
- **Soft navigation & `<Activity>` reveal (the reason the re-applier exists — the persistent chrome
  doesn't reload):** `ThemeReapplier` (client) re-stamps `<html>` from the declarations it holds as a
  prop, in a **layout effect**. Its imperative `<html>.style` write out-ranks the `:root` rule, so
  the visible route always wins even with several routes' `:root` styles mounted at once under
  `<Activity>` — no per-route collision (the write layers _alongside_ the scheme toggle's inline
  `color-scheme`, never clobbering it). It must be a layout effect, not an insertion effect: an
  insertion effect does _not_ re-run on `<Activity>` reveal (a back/forward-revealed route would keep
  the previous route's theme), whereas a layout effect participates in Activity's hide/show cycle and
  re-asserts this route's theme before paint.

The primitives live in `src/lib/theme.ts` + `src/components/theme/{ThemeStyle,ThemeReapplier,PageTheme}`;
`PageTheme` composes both halves from one seed resolution.

`semantic/color.css`'s `:root` semantic color tokens are the engine's own fallback token set
(`buildTokenSet(undefined)`) baked as static `light-dark()` literals — the fallback ground for the
surfaces that render with **no** page theme (404 / error / loading + the chrome around them,
which never mount a `<PageTheme>`); a themed route's `:root` `<style>` (and the imperative `<html>`
re-applier) out-rank them. There is no canvas wash and no `:has()`-scoped body re-bind: the page
theme supplies `--background` to every route. The cascade order is
`@layer base, components;` — there is no `theme` layer, because the entry's theme
font scopes to its own slot via an inline style on `[data-entry]` (`EntryScope`), not a cascade
layer.

### The OKLCH engine

The engine is the load-bearing, genuinely hard piece of the system — not a lightness ramp but a
small color _system_. It is **both a feature and a demo — same logic, two-plus consumers.**

- A **pure function**: takes a theme color **and a scheme**, emits a color-token set. Knows
  nothing about entries. Lives in its own workspace package (`packages/oklch`, imported as
  `@garden/oklch`) — no React, no DOM, no Node built-ins — as the single source of truth
  for the algorithm. Its isomorphism is **enforced**, not hoped: a lint import-boundary on the
  package forbids `next/*`, `react`, `react-dom`, and DOM/Node globals, and a dual-environment
  test runs the suite under both `node` and `jsdom`. (Do **not** use `server-only`/`client-only` —
  those pin it to one side and break the requirement.)

- **Scheme-aware.** The signature is `(themeColor, scheme) → tokenSet`. One `themeColor`
  per entry generates **both** light and dark ramps — dark is reduced chroma + shifted surface L
  with on-color contrast re-solved, not "invert L." The scoped `<style>` emits both via CSS
  `light-dark()` so a single block carries both schemes and switching is pure CSS, respecting
  `prefers-color-scheme`. A seed too light to serve as the light-mode primary is auto-assigned as
  the **dark-mode** theme, with the light-mode theme derived from it.

- **Contrast is solved, not stepped.** OKLCH `L` is perceptual lightness, _not_ WCAG
  relative luminance or APCA Lc — a fixed ΔL passes for a blue theme and fails for yellow/cyan at
  the same steps. The engine takes a contrast target (APCA Lc for text, WCAG 2.x as compliance
  fallback) and binary-searches `L` for accent-foreground/on-surface pairs against the relevant background.

- **Gamut-map before contrast math.** OKLCH chroma routinely exceeds sRGB and even P3; the
  engine cusp-maps (Ottosson-style chroma reduction toward the boundary) to the chosen target
  gamut (P3 vs sRGB, chosen explicitly) _before_ computing contrast, so the math is done against
  the color the screen actually shows.

- **Bakes literal `oklch()` values server-side.** The engine emits resolved, gamut-mapped,
  contrast-solved literals — not relative-color CSS. Live per-token CSS override is explicitly
  **not** a goal: no consumer needs the cascade to re-derive a mid-chain token (card swatches
  re-run the pure function in JS; so does the interactive Color Engine, the `color-engine` module). Relative-color (`oklch(from …)`) is permitted only
  for decorative, non-contrast deltas. This is also what makes server-side validation possible.

- **Focus-ring _color_ is an engine token**; only its geometry is part of the global foundation. The
  global reset is kept free of other smuggled looks (`::selection`, `accent-color`, default link
  color) — those belong in the scoped tier.

- **Status colors are canonical-hue, accent-harmonized.** `success`/`warning`/`error`/`info` use
  **fixed canonical hues** (green / amber / red / blue), so they stay recognizable — error is red, a
  usability requirement, not an accent-shifted guess. They are **not** derived from the accent hue. What
  harmonizes them with the slot is the **treatment**: each is contrast-solved, gamut-mapped, and
  re-solved per scheme through the same pipeline as the rest of the ramp (and against the slot's own
  accent-tinted worst-case surface). They're part of the engine's designed output; the deeper
  accent-lean rules are a deferred follow-up (see the GitHub issue tracker).

- **Defensive, never throws.** `themeColor` comes from an editor and may be invalid or
  out-of-gamut. The engine parses/clamps/gamut-validates and **returns a safe fallback palette**
  rather than throwing — a bad color is expected data, not an exceptional bug. This pairs with
  author-time Sanity validation (see the content model) and an `EntryScope` backstop (the content
  model and repo & hosting sections).

- Runs **per page** — once per route, seeded by the page's authored theme color (`PageTheme`
  stamps the result on `<html>`; see the site-wide delivery section). **Cards are a lighter call**:
  a featured-home card needs a few colors, not the full token set, so it derives them from the same
  engine (via `cardSwatches`) and spreads them inline as generic semantic-token overrides — its own
  entry's `theme.color`.

- Delivered as a **hoisted `:root` `<style>`** (`PageTheme` → `ThemeStyle`, re-stamped imperatively
  on `<html>` on soft nav). On Vercel this is genuinely **flash-free for color**: the theme color is
  known on the _server_, so the baked declarations are in the initial `<head>` — ahead of the chrome —
  server/client RSC payloads agree, and there's no hydration mismatch and no FOUC. The imperative
  soft-nav write to one node can't collide
  across the routes `<Activity>` keeps mounted — the delivery section covers the full mechanism.

- **Ramp-primitive tier, semantic tokens bound to it.** The engine emits a per-role
  generative ramp — `accent`, `neutral`, and the four status ramps, each **11 `50…950` steps**
  (a pure perceptual-lightness primitive, gamut-mapped, with an out-of-gamut flag per step) — and
  the **semantic role tokens bind to ramp steps** rather than being solved in isolation: a surface
  pins a fixed neutral step (the light end in light mode, the dark end in dark — the per-scheme
  re-solve), and every readable-on-surface token binds to the _smallest step that clears_ its
  contrast target (`minPass`, with an extreme-step fallback). The one exception is the accent
  **fill**: it is the accent's identity, so it stays a faithful continuous solve anchored at the
  seed's lightness, with its accent-foreground label a near-white/near-black extreme that clears with
  headroom. Consumers see the generic semantic **names** (`--surface`, `--accent`, … bound to,
  e.g., `neutral`'s `800` step) — the ramp math stays behind them. The page's `<html>` write carries
  the full token set (incl. the `--ring` alias and status); the entry's slot adds only
  its per-role font overrides (`--font-heading` / `--font-body` / `--font-mono`), inline on `[data-entry]`. The raw `--<role>-<step>` primitives are
  emitted alongside for a consumer that wants them (`rampSetToDeclarations`). Dark re-generates each ramp (reduced chroma) and re-solves every
  binding against dark's own surfaces — not a mirror-label flip. The **accent** ramp is additionally
  **anchored to the seed**: one step (keyed off the seed's native direction, reported as
  `anchorLabel`) is bent to the seed's exact lightness — endpoint-preserving, still monotonic — so
  the accent's own color sits on its ramp and the native-scheme accent fill is that step exactly
  (when the seed's own lightness can host the accent-foreground label; extreme seeds clamp just inside the scale).
  Neutral/status ramps stay on the shared scale. **Generative rules** (`EngineOptions.rules`)
  parameterize how the ramp tier is shaped — lightness distribution, chroma policy, hue policy,
  tinted neutrals — with every default reproducing the un-ruled output; distributions reshape only
  the interior steps (`300…700`) while the surface-bearing shoulders stay pinned, so the engine's
  contrast guarantees hold under every policy. The Color Engine (#73) surfaces them ("Rules · set once").
  A separate **decorative accent-harmony palette** (`buildHarmonyPalette`) emits analogous /
  complementary / triadic / split-complementary hue sets at the seed's own L/C, gamut-mapped —
  expressly non-semantic and non-contrast-bearing (status colors stay canonical-hue; a consumer
  backing text with a harmony color contrast-checks it via `checkContrast`).

- **The public surface is drift-guarded, not frozen.** `@garden/oklch` is an internal,
  project-only package — this repo is its **only** consumer — so its whole surface (the semantic
  token names `THEME_TOKEN_NAMES`, ramp roles `RAMP_ROLES`, step labels `RAMP_LABELS` — `50…950`,
  the emitted custom-property names, the high-level signatures) is **freely changeable**, up to a
  major-version bump for a new feature. A public-surface guard test
  (`packages/oklch/src/api.test.ts`) exists only to catch **silent, uncoordinated** drift between
  the engine and its consumers — never to forbid change: a deliberate change updates the guard in
  the same PR. Additions extend the guard in the same commit; renames/removals migrate every
  consumer in the same PR (no deprecation window inside a monorepo). Alongside the in-repo CSS serialization, the engine exports **portable formats**
  for the Color Engine export UI (#107): a Tailwind v4 `@theme` block (`--color-*` namespace, ramps 1:1
  to the Tailwind numeric scale) and W3C-DTCG design-tokens JSON (per-scheme groups), each
  serializable as `oklch` (native), `hex`, or `rgb`.

**Three call sites, one engine:**

- **Author-time validation (`studio/schemaTypes/shared/colorValidation.ts`)**: the Studio's
  `theme.color` / `theme.colorDark` validation runs the same `buildTokenSet` pipeline (parse →
  gamut-map → contrast-solve) for editor feedback (see the content model).
- **Per-page delivery (`resolveThemeDeclarations`)**: `PageTheme` runs the **same engine**
  (`buildTokenSet` + `tokenSetToDeclarations`) to stamp a page's authored theme on `<html>` (see the
  site-wide delivery section).
- **Preview swatches (`cardSwatches`)**: a featured-home card calls `cardSwatches(themeColor)` — the
  **same engine**, returning a few stops spread inline as generic semantic-token overrides
  (`--surface`/`--foreground`/`--border`/`--accent`), so each card wears its own entry's `theme.color` with
  no slot scope and no `<style>` block.

The **Color Engine** — an entry module whose interactive slot re-runs the pure engine in JS
on each control change (type a seed, watch the palette regenerate) — ships as the
`color-engine` module (`src/entries/color-engine/`), the component registry's first real
key. A showcase module renders its slot's baked tokens by consuming the scope's CSS variables;
it need not call the engine at runtime (the Color Engine is the exception — it re-runs the pure
function in JS live, and reports the engine's own receipts: per-token binding provenance,
measured contrast, the anchor readout).

Its interactive demo has been **removed pending a rebuild** on the deliberate design-system
foundation (the old surfaces carried pre-foundation type literals). The `color-engine` key stays
registered to a placeholder `Canvas` so the published entry still resolves on the **demo
template** (sidebar + canvas); the tool is rebuilt later, and may eventually grow into a
**multi-page demo** (#149).

When rebuilt, it is meant to be the **one place a visitor plays with a seed** — the provider holding
the live seed/rules in React state and driving the page's `<html>` theme off the generated palette
(`ThemeReapplier`, the imperative re-applier that also lands the authored theme), so moving a
control repaints the **whole** page — chrome included — in the palette it generates. That play is
**ephemeral** by design: React state only, no `localStorage`, reset on hard reload, and it never
bleeds onto authored routes (every route re-asserts its own theme on navigation / `<Activity>`
reveal).

Two deliberate consequences:

- **It themes itself, on purpose.** The Color Engine's slot (`color-engine`) is themed like any
  other, so its own theme tokens are generated by the engine it showcases. No circular dependency
  in code (the demo depends on the engine; the engine depends on nothing).
- **Keep it isomorphic** (enforced — see above).

The anti-pattern to avoid: putting the engine _inside_ an entry module and having the theming
layer reach up into a portfolio piece for infrastructure — that inverts the dependency direction.
Shared logic lives in a shared module; the demo is a presentation of it.

### The type engine

Type follows the same shape as color: a pure, isomorphic engine (`@garden/type`, sibling of
`@garden/oklch`) whose output is **baked into `foundation/typography.css` and guarded**. Where the color
engine's load-bearing guarantee is **contrast**, the type engine's is **zoom (WCAG 1.4.4)**.

- **Size is decoupled from role.** The engine deals only in **scale steps**, not roles. It solves
  a modular scale (Utopia **dual-ratio** — a tighter `minRatio` on mobile so deep steps still fit,
  a wider `maxRatio` on desktop for drama) into a Radix-style numeric ramp of per-step fluid
  `clamp()` sizes, emitted as `--type-size-1 … N` (1 = smallest; the base at `baseIndex`). This is
  the **foundation** tier: a demo reads any step directly, or imports the engine to compute a
  bespoke scale.
- **The zoom cap is the guarantee.** A fluid `clamp()` fights full-page zoom (zoom scales `rem`
  but shrinks the CSS viewport, so the `vw` term works against the user). Reachability of 200%
  apparent size within the browser's ~500% ceiling reduces to `maxPx ≤ 2.5 × minPx` per step; the
  engine enforces **2.4** (a margin), pulls a hot step's ceiling down, and **flags** it
  (`zoomCapped`) — the analog of the color engine's out-of-gamut flag. Solved, never eyeballed. It
  **never throws** (bad config → default ramp).
- **Roles are the app's semantic layer, bound to steps.** The engine has no role vocabulary; the
  app owns it. `semantic/type.css` binds each role's size to a step —
  `--type-heading-size: var(--type-size-6)` — alongside its family/weight/tracking/leading, so a
  retune moves a role to a different step with no call-site change, and roles can be added or
  dropped without touching the engine. The roles: **display · title · heading · subheading · lede ·
  body · label · meta · kicker** (the superhead above a page's h1, naming what the page is before
  the headline says it) **· caption · quote** — editorial roles only. Chrome-specific type (the nav
  links) is not a role: each is a component-token bundle in its own module, so the role sheet
  stays exactly the vocabulary the type engine will one day derive.
- **Editorial content reads roles via `<Heading>` / `<Text>`.** `Heading` renders the `<hN>` for
  its `level` (the a11y outline) and applies a role by `variant` — or by the level when `variant`
  is omitted (1→`title`, 2→`heading`, 3–6→`subheading`; the oversized `display` is opt-in for a
  hero). `Text` renders `<p>` (or any element via `asChild`) in
  `body`/`lede`/`label`/`meta`/`kicker`/`caption`/`quote`.
  Both also wear their ink via `color` — a semantic color role (`foreground` ·
  `muted-foreground` · `accent-text`), applied through the shared `textColor` rules; omitted, the
  primitive inherits the ambient ink. Discrete roles apply via `data-*` attributes (the variant
  mechanism), not the value-conduit the spacing primitives use for continuous lengths. The
  primitives read **only** the semantic role tokens, never a raw `--type-size-*` step. So a
  **page's** CSS Modules — its editorial content expressed through the primitives — own only
  layout + decoration (margins, borders, `text-transform`), no type value and no static ink;
  `color` stays in a page module only for state (`:hover`, `aria-current`) and for elements the
  primitives don't render. **UI-chrome** components (buttons,
  nav, tabs, chips) still read foundation type tokens (`--type-size-*`, `--font-weight-*`, …)
  directly — a pragmatic boundary, the same "does chrome reach the foundation layer" question the
  spacing accessor raises (#224), not yet resolved either way. What holds everywhere: **no bespoke
  type _literals_** — every value is a token, snapped to the nearest scale step where a source had
  no exact match.
- **Bake-and-guard emission.** The global scale is not per-entry runtime-varying (unlike color), so
  the engine's `--type-size-*` output is baked as `clamp()` literals into `foundation/typography.css`;
  `src/styles/semantic/type.test.ts` re-derives the ramp from `@garden/type` and fails on any drift (and pins
  that roles bind to steps, and that the old Tailwind-named `--text-*` scale is gone).

### Downward theming

The **themed entry's slot scope is the single downward-theming owner** for the theme: it re-defines the
semantic tokens with the entry's theme values (from the OKLCH engine) plus any other semantic
overrides, and themes everything beneath it — the interactive slot and the interleaved slot blocks —
by passing those values _down_. They all read the same generic semantic tokens; the
slot scope is the authority. The page chrome around the slot reads the semantic color tokens as
written on `<html>` by the page's theme, and the global editorial font; the foundation primitives
sit above, shared.

The directional rule:

- **Host themes the child downward** by setting the semantic tokens the child consumes. Fine.
- **Child reaching up** for an ancestor's _theme_ value. Banned.
- **Reading the global _foundation_ primitives** (spacing, motion). Allowed — it's shared plumbing,
  not a look.

The override surface is precise: you override the **seed** (re-run the engine, server-side, per
scope) **or** a **leaf consumable token** (`--accent`, `--font-body` — a literal a host sets and a
component reads). You never override a _mid-chain derived_ token and expect its derivatives to
recompute — the engine baked them. The `var(--public, var(--_internal-default))` pattern is for
composition-time downward theming of primitives, not live ramp re-derivation.

Self-sufficiency still applies _within_ the slot: a shared primitive must not assume tokens from
any _specific_ entry's scope. It ships its own defaults and reads generic semantic names
(`--surface`, `--accent`, `--font-body`), so it works composed into any entry (or none).

---

## Layout primitives

Layout is composed from small, content-agnostic primitives that own **one** structural concern
(column flow, a row, a frame) and nothing else. They read the ambient space scale and never care
what they hold, so a page expresses layout by composing primitives rather than hand-writing
margins per component.

### The conduit + typed-accessor pattern

A primitive takes its spacing as a **prop** and passes it **straight through to an inline CSS
custom property** — it does not compute a style. This "conduit" indirection is deliberate: because
the value lands as a custom property the CSS reads, a container query or a `@garden/type`-style
space-derivation engine (the type engine already derives type sizes exactly this way) can override
it in CSS **without touching the call site**. The prop accepts any CSS length string, so an engine-derived `clamp()`
passes through unchanged.

Type safety comes from a **typed accessor**, not from constraining the prop:

- `src/lib/tokens.ts` exports `space(step)` → `"var(--space-<step>)"`, with `step` constrained at
  compile time to the real scale (`SpaceStep = 1…9`). `space(6)` is how a caller names a step
  without hand-writing `var(--space-6)` and without being able to pick an off-scale number.
- The module is **dependency-free and side-effect-free** (mirroring `src/lib/keys.ts`): a token
  contract the app — or the standalone Studio — can import without pulling in app code. It only
  _names_ the steps; the scale **values** live in `foundation/space.css` (`@layer base`).
- The prop itself stays a plain `string`, so the escape hatch (a raw token, an engine `clamp()`)
  is always open; `space()` is the ergonomic, guarded default, not a gate.

The primitive writes its token onto the shared `style` channel, so a caller's `style` is **merged
deliberately** — token first, caller's `style` last — and an explicit caller override wins.

### The space scale & semantic roles

Two layers, matching the token architecture:

| Layer                | Tokens                                                 | Role                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Foundation** scale | `--space-1 … --space-9` (`foundation/space.css`)       | raw steps on a 4px grid (`0.25rem … 6rem`). No `0` step (use a smaller step or none); a step past `--space-9` is appended when something needs it. Radix/Tailwind-parity 1–9.                                                  |
| **Semantic** roles   | `--space-{inset,gutter,stack,cluster}` (`@layer base`) | the thin layer of **named** structural spacing primitives and templates read, so a page expresses _intent_ ("inset", "gutter") over a magnitude. Each aliases a foundation step — retune one alias to reflow the whole system. |

The semantic roles are deliberately few — space, unlike color, needs only a handful (the raw scale
covers the rest):

| Role              | Aliases     | Meaning                                                  |
| ----------------- | ----------- | -------------------------------------------------------- |
| `--space-inset`   | `--space-5` | padding _inside_ a container / card / panel              |
| `--space-gutter`  | `--space-6` | the page frame's inline breathing room (edge padding)    |
| `--space-stack`   | `--space-4` | default vertical rhythm between stacked blocks           |
| `--space-cluster` | `--space-3` | gap between inline items in a wrapping row (meta, chips) |
| `--space-grid`    | `--space-5` | gap between cells in an intrinsic responsive grid        |

A `@garden/type`-style derivation of the space scale would later _back_ these same names — so
components and templates commit to the **role names now**, and the values become derived later
without a call-site change.

### `Stack`

The vertical-rhythm primitive (`src/components/layout/Stack.tsx`): lays its children in a column
with one consistent gap and owns nothing else.

- **`gap?: string`** — the column gap, passed through the `--stack-gap` conduit. Omit for the
  default rhythm (the `--space-stack` semantic role). Use `space(n)` to name a step.
- **`asChild?: boolean`** — render the single child instead of a wrapping `<div>` (Radix `Slot`),
  merging the stack's class + token onto it — e.g. `<Stack asChild><ul>…</ul></Stack>` to stack
  real list items with no extra wrapper.
- Extends the intrinsic `<div>` props (`React.ComponentPropsWithRef<"div">`), so every native
  attribute, a `ref` (forwarded to the underlying element — or, under `asChild`, the child via
  Radix `Slot`), and a caller `style`/`className` compose.

Its CSS Module is `@layer components` and strictly var-consuming: `gap: var(--stack-gap,
var(--space-stack))` — the conduit prop wins when set, the semantic role is the default.

```tsx
import Stack from "@/components/layout/Stack";
import { space } from "@/lib/tokens";

<Stack gap={space(6)}>…</Stack>          // named scale step
<Stack asChild><ul>…</ul></Stack>        // no wrapper; default --space-stack rhythm
```

### `ContentGrid`

The content-grid layout primitive (`src/components/layout/ContentGrid.tsx`) — the site's **one
width system**, the industry-standard breakout grid (Josh Comeau's full-bleed layout / Ryan
Mulligan's "Layout Breakouts"): one grid owns three named lanes, and the gutter lives in the
grid's tracks, not on a clamping wrapper.

- **`prose`** — the reading measure (`--width-content`), the default lane: children land here
  unless they set their own `grid-column`.
- **`wide`** — the breakout lane (`--width-wide`), for media, slots, and the chrome bands' rows.
- **`full`** — true edge-to-edge (it spans the outer tracks, which floor at `--space-gutter` so
  `wide`/`prose` stay inset at every viewport).
- **`asChild?: boolean`** — merge the grid onto the child element itself (Radix `Slot`), e.g. to
  make a semantic `<article>`, `<nav>`, or `<footer>` the grid.

Page content and the chrome bands (`SiteNav`, `SiteFooter`) all mount the same grid,
so the whole viewport shares one alignment system. It owns the column lanes only — vertical
rhythm, ink, and band styling stay with the consumer.

**The lane attribute contract:** a direct grid child stamps `data-lane="prose|wide|full"` to take
a lane (zero-specificity, so an explicit `grid-column` still wins). The media/slot body blocks
(`figure` · `video` · `slot`) author it via the shared Studio `lane` field — `wide` is their
default, `full` the deliberate bleed, `prose` the tuck-in — and the serializer sanitizes unknown
values back to `wide` (`src/lib/lanes.ts`).

### `Page`

The route content frame (`src/components/layout/Page.tsx`): the **single `<main>` landmark every
route mounts**, which **is the page's `ContentGrid`** (merged onto the `<main>` itself). It adds
only what the grid doesn't own — the landmark, the **skip-link target**, and the frame's block
padding. It has no width prop: a route's children take a lane (`prose` by default), never a frame
cap.

It renders `<main id="main-content">` — the anchor the shell's skip-link targets (see
[`accessibility-and-performance.md`](./accessibility-and-performance.md)); the `id` is overridable
via passthrough, and it extends `React.ComponentPropsWithRef<"main">` so native attributes, a
`ref`, and a caller `className` compose. Its CSS Module is `@layer components` and strictly
var-consuming: block padding only (`padding-block: var(--space-gutter)`). Vertical rhythm between
the frame's children is not the frame's concern — compose it separately.

```tsx
import Page from "@/components/layout/Page";

<Page>…</Page>; // renders <main id="main-content"> — the page's content grid
```

### `Grid`

The intrinsic-responsive-columns primitive (`src/components/layout/Grid.tsx`): lays its children
into as many equal columns as fit, each at least `min` wide, wrapping with **no media queries**.
The responsiveness is intrinsic — this repo has no breakpoint layer.

- **`min: string`** (required) — the column floor (the `minmax()` minimum), passed through the
  `--grid-min` conduit. A CSS length; a narrower container wraps to fewer columns on its own. It has
  no default: a column floor is design-specific per grid, so the caller always names one.
- **`gap?: string`** — the cell gap, passed through the `--grid-gap` conduit. Omit for the default
  (the `--space-grid` semantic role); use `space(n)` to name a step.
- **`asChild?: boolean`** — render the single child instead of a wrapping `<div>` (Radix `Slot`),
  merging the grid's class + tokens onto it — e.g. `<Grid asChild><ul>…</ul></Grid>` to lay out
  real list items with no extra wrapper.
- Extends `React.ComponentPropsWithRef<"div">`, so every native attribute, a `ref`, and a caller
  `style`/`className` compose.

Its CSS Module is `@layer components` and strictly var-consuming. `auto-fit` is **hard-coded** (no
fill/fit variant prop — the minimal API commits to one fill mode), and the floor is wrapped in
`min(…, 100%)` so a single column can't overflow a viewport narrower than `min`. The gap reads the
`--space-grid` role by default, overridden by the conduit prop:

```css
grid-template-columns: repeat(
  auto-fit,
  minmax(min(var(--grid-min), 100%), 1fr)
);
gap: var(--grid-gap, var(--space-grid));
```

Under `asChild` it merges onto the child, so the child owns only its own concerns (a `<ul>`'s
list-reset, say) while `Grid` owns the columns and the default `--space-grid` gap.

```tsx
import Grid from "@/components/layout/Grid";
import { space } from "@/lib/tokens";

<Grid min="20rem">…</Grid>                         // responsive columns, default --space-grid gap
<Grid asChild min="20rem"><ul>…</ul></Grid>        // no wrapper; real list items
<Grid min="20rem" gap={space(6)}>…</Grid>          // override the gap with a named step
```

### `Cluster`

The wrapping-row primitive (`src/components/layout/Cluster.tsx`): lays its children out in a row
that wraps, with one consistent gap, and owns nothing else — for meta rows and chip lists.

- **`gap?: string`** — the inline gap, passed through the `--cluster-gap` conduit. Omit for the
  default meta-row spacing (the `--space-cluster` semantic role). Use `space(n)` to name a step.
- **`asChild?: boolean`** — render the single child instead of a wrapping `<div>` (Radix `Slot`),
  merging the cluster's class + token onto it — e.g. `<Cluster asChild><div>…</div></Cluster>` to
  make an existing row wrap inline with no extra element.
- Extends the intrinsic `<div>` props (`React.ComponentPropsWithRef<"div">`), so every native
  attribute, a `ref` (forwarded to the underlying element — or, under `asChild`, the child via
  Radix `Slot`), and a caller `style`/`className` compose.

Its CSS Module is `@layer components` and strictly var-consuming: `display: flex`, `flex-wrap: wrap`,
and `gap: var(--cluster-gap, var(--space-cluster))` — the conduit prop wins when set, the semantic
role is the default. It deliberately sets **no cross-axis `align-items`**, so a consumer keeps its
own alignment with no same-layer cascade conflict.

```tsx
import Cluster from "@/components/layout/Cluster";

<Cluster>…</Cluster>                              // default --space-cluster gap; wraps
<Cluster asChild><div>…</div></Cluster>          // wrap an existing row inline
```

---

## Entry modules

### Structure

```
src/entries/<slug>/
  ├─ <Module>.tsx       the interactive slot component (the working demo); the route mounts it
  ├─ core/              headless core — ONLY when the slot's logic earns extraction
  ├─ slots/             the module's inline slot components, resolved by slotKey
  ├─ tokens.css         the entry's slot-scoped semantic override (generic names, theme values)
  └─ index.ts           registry entry
src/fonts/roster.ts        curated next/font declarations, one per face, exported by key
src/lib/resolvers/slots.ts       slotKey → slot-component loader — cross-entry widgets
src/lib/resolvers/components.ts  componentKey → () => import("@/entries/<slug>")  [literal imports]
src/*/keys.ts              string-constant key contracts (Studio imports these; resolvers don't)
```

An entry renders as a single `/[slug]` page on one of **two templates, branched by `kind`**:

- **Editorial** (`note` · `essay` · `now` — and any kind the code doesn't recognize): the prose
  reading column, with interactive `slot` blocks interleaved through the prose (`SlotBlock` →
  `slots/*`), each in its own theme scope. `now` is editorial with one exception: it never wears
  its own `theme` — it keeps the shared `/now` seed (colors AND type), so its slots mount
  slug-keyed with the Now theme's faces.
- **Demo** (`kind === "demo"` with a resolved module): a two-region app layout (`DemoLayout`,
  `src/components/entry/`) — **sidebar + canvas**, edge-to-edge in the content grid's `full`
  lane, no prose article (the summary is the demo's prose). **Hybrid sidebar:** the page renders
  the entry's info (title, summary, and the shared `EntryMeta` readout: kind · stage · iterated ·
  seed · link count) — DRY across demos —
  and the module contributes its controls below. A sketch demo (no `componentKey`) falls back to
  the editorial template, prose-only.

The registry entry (the `EntryModule` contract, `src/entries/types.ts`) exports up to three
members — a compile error enforces a mountable one (`Provider` and/or `Canvas`):

- **`Provider`** — a client frame the page wraps the entry's surface in (the editorial
  `<article>`, or the demo's sidebar + canvas), so the module's pieces share state via context.
  The surface stays server-rendered (children pass-through); the provider adds state, never
  markup that re-themes the editorial register. On the editorial template the page threads the
  font seed to the serializer, and each slot mounts in its own `EntryScope` container (per-role
  face overrides per island; color inherited from the page's `<html>` theme).
- **`Canvas`** — the module-owned main surface of a demo. A demo whose resolved module lacks
  `Canvas` is content→code drift and 404s, same as an unresolvable `componentKey`.
- **`Sidebar`** — the module's controls, mounted inside the page-owned sidebar shell below the
  entry info. Meaningless without `Canvas`. On the demo template ONE `EntryScope` wraps sidebar
  controls and canvas together.

Nothing more is templated: the page is the template plus the module's composition. A headless `core/` is **not** templated into every module — let it
emerge only when a slot's logic warrants extraction (same deferral discipline as the
slot tiers; see the interactive slot section). Code lives under `src/entries/<slug>/`;
**routes are flat** — `/` is the
**featured** front door, a browsable **Index** (nav-labelled "Index") lists the notes, essays, and
demos at **`/browse`**, `/now` streams the dated `now` updates, and a root-level `/[slug]` (a dynamic segment
that cedes precedence to the static segments `/browse`, `/about`, `/now`) mounts any entry. Every
entry — whatever its `kind`, `now` included — lives at a **flat top-level slug** (`/some-note`, not
`/notes/some-note`), so its URL stays stable even if its `kind` changes. There is no `/work` prefix. The browse route is `/browse`, **not
`/index`**: Next.js reserves `index` for the root segment's prerender output (`app/index.html`), so a
route literally named `index` silently serves the home page.

**Start single-tier** — one shared `src/lib/resolvers/slots.ts` until a second entry actually reuses a
widget; introduce the entry-local tier only then. Once you do, slots follow the **same
per-entry-plus-shared shape as tokens and fonts**. For a given entry the resolver composes the
two (`{ ...shared, ...entryLocal }`) so an entry-local key **overrides** a shared one of the same
name — the downward-override spirit of `var(--public-override, var(--_internal-default))`. A
_shared_ slot themes off the **generic semantic tokens** (`--surface`, `--accent`, `--font-body`),
never anything entry-specific. Promote a widget into the shared registry only once it's genuinely
reused; both tiers lazy-import.

Entry-specific composites belong to their entry module — but **UI primitives are built out
proactively into `src/components/ui/`, even while single-use**. A primitive (an interactive
control, a panel frame, a meta label) is a design-system unit by nature: it reads the generic
semantic tokens, ships its own defaults, and works composed into any entry or none, so it goes
to `ui/` the moment it's recognized as a primitive, not on its second consumer. An entry may
also _consume_ shared logic without owning it — an engine-showcase module (the Color Engine)
showcases the shared engine's output rather than holding the engine (see the OKLCH engine).

### The CMS ↔ code registry

```
Sanity entry doc { kind, componentKey: "<slug>", theme { color, colorDark, headingFont, bodyFont, monoFont }, body, stage, iterated, related, featuredRank }
        │
        ▼
src/lib/resolvers/components.ts   componentKey "<slug>" → lazy import of the entry module
        │
        ▼
src/entries/<slug>/   its page (editorial article + interactive slot) + inline slot components
```

- **Content references; code resolves.** The essay comes from Sanity and references coded
  components by key, resolved against the entry-local `slots.ts` first, then the shared
  `src/lib/resolvers/slots.ts`. The CMS never reimplements interaction.
- **Keys are a contract with no referential integrity — guard the seam.** `keys.ts` is the
  **single source of truth** for which keys exist; resolvers are typed `satisfies Record<Key, …>`
  so a missing resolver entry is a **compile error** (converts code→code drift from a runtime crash
  into a build break). Resolvers return a typed `NotFound`, never a bare `map[key]` lookup, so the
  content→code direction (a saved Sanity key whose code was renamed/deleted) degrades to a visible
  fallback instead of crashing — `not-found.tsx` for a `componentKey`/slug miss, a "missing slot"
  placeholder in the Portable Text serializer for a `slotKey` miss. (A CI check that GROQs all
  _published_ keys and asserts each exists in code is an additive safety net — the `published-keys`
  CI job, `scripts/check-published-keys.mjs` / `pnpm lint:keys:published` — not a schema decision.)
- **Lazy-load each module** via a **literal** dynamic import per key
  (`() => import("@/entries/<slug>")`, never a templated `import(\`…/${slug}\`)`, which defeats
  bundler static analysis). Server Components are auto-split already; the manual lazy import
  buys conditional inclusion, and the real client-bundle savings come from the Client Components
  _inside_ each module.

### The interactive slot: logic in a headless core (when it earns one)

Each demo's interactive slot actually works. As a general engineering
practice — not for any packaging or reuse goal — its logic _can_ live in a **headless core** (hooks
/ pure functions — state machines, reducers, derivations), with presentation as separate primitives
the slot composes. That split is internal hygiene only, and it is **not mandatory**: a
toggle/slider demo doesn't need a state machine in a separate folder. Extract a `core/` when the
logic warrants it.

There's no demo-vs-slot boundary to maintain. The slot owns its own state and renders
directly. The same interactive slot — or smaller bespoke live components — can be **mounted
inline in an essay** by key, in place of screenshots (see the content model), under the same entry
scope, so it themes identically.

---

## Fonts

**Store-the-key (roster-by-key).** A curated roster of faces is declared in code (each a `next/font`
export, in a single shared module); Sanity stores up to **three** per-entry face keys —
`theme.headingFont` / `theme.bodyFont` / `theme.monoFont` — each authored as a **free-text key**
in the Studio (no dropdown: the schema deliberately can't import the roster, so its field
descriptions say _"ask a developer for the valid keys"_; the `published-keys` CI net catches an
unknown key).
The entry's **slot scope** applies each resolved face via that face's **`.variable` class** on the
`[data-entry]` wrapper, re-binding that role's token (`--font-heading` / `--font-body` / `--font-mono`)
for the slot only. Each face is **independent and optional**: an unset — or unresolvable — role emits
**no override** and simply inherits the site palette, so page chrome, and any role the entry doesn't
theme, stays on the site faces (the never-throws fallback is "inherit `:root`", not a hardcoded face).
This keeps `next/font`'s self-hosting, subsetting, and zero-CLS sizing while putting an entry's type
choice on its document alongside its theme color.

`next/font` must be called at module scope, so the roster can't be _arbitrary_: an editor picks from
the curated set, never a free-text name or upload. **Adding a face to the roster is a code change;
choosing among existing faces is content.**

Two facts make a large roster cheap:

1. **Declaration ≠ download.** Calling `next/font` emits an `@font-face` + a CSS variable; the
   browser only fetches a font file when rendered text uses that family. Declaring fifty fonts costs
   zero downloads on a page that uses none of them.
2. **Preload is build-time static analysis — and the entry's font key is a runtime index.** `next/font`
   injects `<link rel=preload>` for a face it can _statically_ see a route reference. Because the
   roster resolves a per-entry face key (`theme.headingFont` / `bodyFont` / `monoFont`, Sanity strings) →
   face at **runtime**, Next cannot target the resolved per-entry face for preload. This is **not** an SSG-vs-dynamic question (that
   route-level toggle is gone under Next 16 `cacheComponents`; see repo & hosting) — it's a
   build-time-static-analyzability question, independent of caching.

So, the policy:

- **`preload: false` on every roster face** by default (the default is `true`, so this must be set
  explicitly). The **1–2 editorial faces** in the root layout are `preload: false` too; any
  above-the-fold preload is emitted as a manual `<link>`, not via the loader flag.
- **Per-entry faces are applied, not preloaded.** An entry's slot face (behind a `/[slug]` click)
  tolerates `font-display: swap`. If a specific above-the-fold entry face genuinely must preload,
  emit the `<link rel="preload" as="font" crossorigin>` manually.
- **Verify empirically:** `pnpm build`, visit `/[slug]`, view-source the `<head>`, count
  `<link rel="preload" as="font">` — confirm the policy holds (expect only the manually-linked
  above-the-fold face, if any).
- **Where the link lands** (initial shell vs streamed hole) is the other axis: keep `EntryScope`
  in the prerendered shell (see repo & hosting) so the slot's resolved font references (its
  `.variable` classes + inline role-token overrides) are in the initial static HTML.

Mapped onto the layers:

- **The site faces** (the global identity — **Space Grotesk** headings, **Source Serif 4** body,
  **Geist Mono** mono) → root layout, `preload: false`; any above-the-fold preload is a manual
  `<link>`. Every page's chrome uses them, and they are the palette every un-themed slot role inherits.
- **Per-entry fonts** → resolved from the entry doc's `theme.headingFont` / `bodyFont` / `monoFont`
  against the code-side roster, applied at the entry's `[data-entry]` **slot** scope via each face's
  `.variable` + its role-token override — they theme the slot, not the page.
- **Shared fonts** → the roster _is_ the single declaration point, so a face two entries use is
  declared **once** and resolved by both. (Geist Mono is the site mono; **JetBrains Mono** is a roster
  face an entry can pick for a slot — a roster face is _not_ mounted globally, only per-entry.)
- **Slot fonts** → nothing declares its own `next/font`; content reads the role tokens
  (`--font-heading` / `--font-body` / `--font-mono`), which the slot fills from the resolved faces (or
  inherits from `:root` when a role is unset). The type primitives (`Heading` / `Text`) carry the entry
  faces via the `--type-*-family` bundles — declared once in `semantic/type.css` at both `:root` and
  the slot scope, re-substituting against the slot's leaves — and `reset.css`'s `h1–h6` rule carries
  `--font-heading`. There is **no** `[data-entry]` body baseline rule: every slot descendant is a
  primitive that self-sets `font-family` from a bundle, so plain non-primitive slot text inherits the
  site body face. Mono likewise has no reset rule — a slot's mono face reaches text only through
  `--type-meta-family` (the type primitives) and component modules that read `var(--font-mono)`.

Practical notes:

- Prefer **variable fonts** (one file, many weights/optical sizes).
- The site is **flash-free for _theming_** (color arrives inline with the markup); fonts are
  **zero-CLS with an intentional `swap`** — next/font's size-adjusted fallback kills layout shift but
  a per-entry slot face will visibly swap as its slot mounts, by design. Decide `swap` vs
  `optional` per face.

---

## Content model (Sanity)

- **Content lives in Sanity; interaction lives in code.** An `entry` document holds the content and
  references a coded module via `componentKey`; the CMS never reimplements interaction.
- **One document type — `entry`; a `kind` field discriminates.** Notes, essays, demos, and
  now-updates are the same shape — a themed page with one or more interactive slots plus prose — so they
  are **one document type**, not several separate types and not a schema-merge that erased the
  distinction. A **`kind`** field (`note` · `essay` · `demo` · `now`) carries the distinction as
  _data_: it groups the Index into its labelled sections and routes an entry to its surface
  (`/browse` or `/now`), so the difference is legible without being a `_type` split. The kinds differ by **scope and emphasis, not fields** — a _note_ is a small,
  often single-component piece (and doubles as a shareable social post); an _essay_ is writing-led with
  interactions slotted in; a _demo_ is an interactive piece with more slots; a _now_ is a dated
  "now" update that drives the reverse-chronological `/now` stream — its own surface, kept out of
  the Index.
  **Downstream, theming and interactivity key on capability (presence), not kind:** every kind
  mounts on a present `componentKey` — `now` included (#328) — and every kind but `now` scopes on
  a present `theme.color`. (`theme.color`
  additionally carries a required _floor_ for note/essay/demo — see below — but the mount/scope
  logic keys on presence, not kind.) A present `theme.color` gives the entry its own brand
  `[data-entry]` scope (and mounts its
  `slot`s in their own scoped containers, exactly as a demo's slots do); a present
  `componentKey` resolves and mounts the coded module — a declared key that fails to resolve is a
  `notFound()` for any kind, and no key at all renders prose-only (a sketch demo renders
  prose-only, never a 404). **A module mount always implies a scope seed** — the route builds the
  `ScopeSeed` whenever an entry _mounts a module_ (any kind) or a _non-`now`_ entry _themes_
  (`(!now && theme.color) || a resolvable componentKey`), always **keyed on the entry's own
  slug**, with each absent `theme.headingFont` / `bodyFont` / `monoFont` passed as `undefined`
  (never coerced to `""`) — and a `now`'s seed omits the doc's font fields entirely, so its
  slots keep the Now theme's faces. So a
  module-only entry (a resolvable `componentKey`, no `theme.color`) still gets its **own** per-entry
  `[data-entry]` scope rather than collapsing onto a shared fallback slug — two such entries must not
  share one `data-entry` and cross-contaminate themes — and its empty theme fields resolve to the
  authored site default (`siteSettings.theme`, #253) for color and, for each unset font role, the inherited site face
  (`--font-heading` / `--font-body` / `--font-mono` from `:root`) — the never-throws keystone is
  "emit no override, inherit `:root`", not a hardcoded fallback face.
  `theme.color` is **optional for every kind** (#253) — an entry that authors none wears the
  authored site default (`siteSettings.theme`), so each page still derives its theme from an
  authored seed. `componentKey` is likewise **optional and mounts on presence for every kind**
  (a `demo` past the sketch stage is no longer forced to name a module — a prose-only demo is
  valid — and a `note`/`essay`/`now` that sets a `componentKey` mounts it), and the three `theme`
  face keys are optional and theme on presence for every kind but `now`. A `now`
  update can hold slots and modules like any editorial entry, but it **never wears its own
  theme**: it **cannot set its own `theme.color`** (the whole `theme` object
  is hidden for a `now` in the Studio and a color is rejected on write by `forbiddenForNow`) and
  **inherits the `/now` page seed** instead — the single `/now` seed themes the `/now` index and every
  `now` entry alike. `stage` does not
  apply to a `now`. A second document type is deferred until a kind genuinely proves divergent fields.
- **`stage` is maturity; `iterated` is freshness.** **`stage`** (sketch → prototype → shipped —
  stable stored values, labels re-wordable in the UI) is the honesty badge on every entry, independent
  of scope (`kind`) and of curation (`featuredRank`). **`iterated`** is an _authored_ "last worked on"
  date — not Sanity's automatic `_updatedAt` — an intentional signal that the portfolio is living and
  tended.
- **The body is rich content (portable text), not plain text.** One shared palette serves every
  kind — `kind` places an entry, it does not restrict the palette (single author, maximum authoring
  flexibility). Prose (`block`) offers Normal, H2, and H3 styles plus bullet/number lists (no body
  H1 — the body sits under the page's `<h1>` entry title, so a body H1 would break the heading
  outline, WCAG 1.3.1). Alongside prose the palette carries four typed blocks: **`figure`** (an
  editor-picked image asset with required alt + optional caption, rendered responsively off the
  Sanity CDN honoring the authored crop) and **`video`** (a provider iframe or native file
  resolved through a pinned host allow-list) — either media block degrades to a labelled
  placeholder when its data can't resolve — the themeable **`slot`** (a live component resolved by `slotKey` in code, wearing the
  entry's theme), and **`quote`** (a semantic pull-quote — the one quotation mechanism; the inline
  `blockquote` prose style is removed so there is a single way to quote). A `now` update may carry a
  `slot` like any kind; with no entry theme of its own it simply renders under the page chrome.
- **`theme` is a per-entry, first-class object** — `{ color, colorDark, headingFont, bodyFont, monoFont }`,
  separate from the top-level `componentKey` (which _mounts_ a module, not part of the theme the module _reads_).
  `color` is a validated string (hex or `oklch()`) — the slot seed, stored on the `entry` document.
  Author-time Sanity `validation` runs the engine's own color pipeline (parse → gamut-map → confirm
  in-spec contrast) for editor feedback. Defense-in-depth: the engine itself never throws (see the
  OKLCH engine) and `EntryScope` falls back to a safe default. `siteSettings` holds the site
  title/description, the **site default theme** — a required, engine-validated
  `theme { color, colorDark }`, the one seed every resolution chain falls back to (#253) — **and
  the per-page theme seeds**: a `pageThemes` object carries an optional,
  engine-validated override for each site-owned page (`/`, `/browse`, `/about`, `/now`, `/system`)
  — the pages with no backing `entry` — exposed by `SITE_SETTINGS_QUERY`. A `now` entry has no
  `theme.color` of its own, so `ENTRY_DETAIL_QUERY` resolves `themeSeed` with a **kind-gated**
  inner rung over the site-default fallback
  (`coalesce(select(kind == "now" => …pageThemes.now, theme.color), …siteSettings.theme.color)`):
  a `now` update always wears the `/now`
  seed (its own `theme.color` ignored), every themed kind wears its own, and an entry with no seed
  of its own wears the site default — resolved in-query so it lands
  in the static shell, flash-free. Wiring each page to consume its seed is the site-wide
  theming-delivery slice.
- **`theme.headingFont` / `bodyFont` / `monoFont` are per-entry** — up to three roster faces this
  entry's slot wears, each an independent, optional choice from the curated roster (see fonts); an
  unset face inherits the site face for that role. Reference-by-key, exactly like `componentKey` and
  `theme.color`.
- **No per-scheme color field.** Dark mode is a render-time axis; one `theme.color` generates
  both schemes. An entry needing a hand-tuned dark brand gets an _optional_ `theme.colorDark`
  override, defaulted from the engine — never a required parallel field (the site default
  `siteSettings.theme` carries the same optional `colorDark`). (A seed too light to be the
  light-mode primary is auto-assigned as the dark theme; see the OKLCH engine.)
- **Keys are a contract; the Studio never imports implementations.** Each reference-by-key field —
  the three faces, `componentKey`, `slotKey` — is a **free-text string** in the Studio schema whose
  description says _"ask a developer for the valid keys"_; the standalone Studio bundle deliberately
  imports **nothing** from the app, so there is no dropdown and no shared key package. The allowed
  values live app-side in `keys.ts` (string constants) with a separate resolver each —
  `lib/resolvers/{components,fonts,slots}.ts` — which the Studio never imports, keeping `next/font`
  and lazy entry bundles out of the Studio bundle. A **CI drift net** closes the loop in place of a
  shared import: `check-key-drift.mjs` guards code ↔ `keys.ts`, and `check-published-keys.mjs` GROQs
  every published key and asserts it resolves in `keys.ts`. See the CMS ↔ code registry for the
  typed-resolver + fallback discipline that makes the soft foreign key safe.
- **Slots: generic `slot` by default; a typed block only for editorial content.** A
  `slot` block stores a `slotKey` + a caption — use it whenever the only authored inputs are
  key + caption (the demo and the majority of in-essay slots; adding one is zero schema change).
  Give a widget its **own typed block only when an editor must author structured _content_** (text
  they write, an image they pick, a list they curate). **Never** model code-level config (variants,
  sizes, initial state) as a block or an untyped `props` blob — default it in the registry, or split
  into two registered keys. Litmus: _editor writes/curates it → typed block; developer decides it →
  registry; neither → it's not an input._
- **The card queries refuse to over-fetch.** The featured-home query pulls the card fields —
  `title`/`slug`/`summary` and the meta facts (`kind`/`stage`/`iterated`/`linkCount`) plus the
  `theme.color` each card themes its plate from — but
  **not** the body. That enforces "a few colors per card" at the data layer (cards feed
  `cardSwatches`) and keeps the front-door payload small for CWV.
- **`EntryScope` is the font-slot keystone.** One server component takes a scope's `slug` + up to
  three font keys (sourced from the entry's `theme.headingFont` / `bodyFont` / `monoFont`) and emits
  the `[data-entry]` wrapper stamping, per resolved face, ONE solved value inline plus that face's
  `.variable` class, flash-free in the initial HTML: the leaf face token (`--font-heading` /
  `--font-body` / `--font-mono`). The role→face mapping — which `--type-<role>-family` bundles read
  which leaf — lives **solely in `semantic/type.css`**, whose bundles are declared under one
  selector list matching both `:root` (the site default) and `[data-entry]` (the slot): a custom
  property substitutes its `var()` refs at the element that declares it, so the same declarations
  freeze to the site faces at the root and re-substitute against the slot's stamped leaves inside
  the slot. TS never learns role names; the sheet never learns per-entry values. It
  wraps a themed entry's **interactive slot(s)** (and any homepage slot `siteSettings` seeds), not the
  page chrome. Color is NOT re-bound here — the slot inherits every color token from the page's
  `<html>` theme. It is **defensive** — an unset or unresolvable face emits no override for that role
  (which then inherits `:root`), and the component is wrapped in `unstable_catchError` (`next/error`)
  as a backstop, **not** a segment `error.tsx` (which doesn't catch its own layout's throw — see repo
  & hosting). It renders in the prerendered shell; the slot's subtree reads the inherited color tokens
  plus whichever font roles the slot binds.
- **Visual editing details.** Disable Sanity **stega** on the entry's `theme` object (by ancestor) — the
  invisible encoding chars break the OKLCH parse and the font-class lookup. `slot`
  click-to-edit targets the caption/`slotKey` field, not the interactive region.
- **Backlinks are Day-1.** An `entry` carries a `related` **self-referencing** array (`entry` →
  `entry`) — **real Sanity `reference` fields**, not free-text slugs (or `references()` finds nothing
  and you reintroduce key-drift) — and the read path resolves **incoming** backlinks via GROQ
  `references()`, so an edge authored once shows on both ends. Because there is one type, the graph is
  cross-kind for free: a demo links a note links an essay. A note stays lightweight (chrome + shared
  components) and pulls a demo bundle only if it explicitly mounts one.
- **Two reading paths over one content graph.** The **featured home** (`/`) is a curated front door —
  the entries with a `featuredRank`, of _any_ `kind`, ordered by rank — for a hurried evaluator. The
  **Index** (at `/browse`) is the browsable list of the notes, essays, and demos — grouped
  into labelled `kind` sections, each row carrying its meta readout (stage · iterated · backlink
  hint), for the
  wanderer. Dated `now` updates are the one kind it omits: they have their own reverse-chronological
  surface at `/now`. The Index has no facets today — filtering it is [#88](https://github.com/jamierthompson/digital-garden/issues/88). The portfolio is a _view_ of the graph (a saved
  `featuredRank != null` filter), not a separate section. The **shell frame** of both — plus `/about`
  and `/now` — wears the page's authored `<html>` theme (see the token & theming architecture). Their
  _content_ differs by intent: the Index is a uniform editorial list, and the **featured home's cards
  are themed plates** — each spreads its own entry's engine-solved palette inline via `cardSwatches`,
  because a card is a bounded slot, not chrome. So a card carries its own `theme.color` while the frame
  around it wears the page theme.
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
  dynamic holes**. `EntryScope` (wrapping a themed entry's slot) renders into the prerendered shell so its
  inline role-token font overrides and the resolved font classes are in the **initial static HTML** (flash-free, no
  streamed delay), while the essay streams; the page's color theme lands flash-free the same way, via
  `PageTheme`'s `<html>` script. This is an app-wide rendering model (request APIs need Suspense or
  arg-passing; `<Activity>`-based state preservation across nav).
- **Error containment is a defensive-engine job, not an error boundary.** A throw in a Server
  Component bubbles to the nearest _parent_ boundary, and a segment's own `error.tsx` does **not**
  catch a throw from that segment's _layout_ — and `EntryScope` is a layout-level wrapper. So
  containment is: engine returns a fallback (never throws) + `unstable_catchError` around
  `EntryScope`. A caught error would also render _unthemed_, the wrong response to a data-quality
  problem — hence "validate + fall back," not "let it throw and catch."
- **One Next.js app for the site; the Sanity Studio is a separate workspace package.** The
  repo is a multi-member pnpm workspace: the Next app at the root, a **standalone Sanity Studio in
  `studio/`** (Vite-based, auto-updating, TypeGen watch mode), and the `@garden/oklch` (color) and
  `@garden/type` (type-scale) engines in `packages/oklch` and `packages/type`. The _site_ is still a single app with
  no entry sub-packages — entry code lives under `src/entries/*`; shared bits live in shared
  `src/` modules. Boundaries are **lint-import rules**: an entry can't import another entry;
  shared can't import an entry; plus the `packages/oklch/**` isomorphism boundary (see the OKLCH
  engine) and the every-CSS-module-declares-its-`@layer` rule (see the token & theming architecture).
- The site runs on **Vercel** with full SSR / RSC. This unlocks server-rendered flash-free per-scope
  OKLCH `<style>` blocks, Sanity draft mode / visual editing, an RSS route handler, a `/now` page,
  and the prerendered-shell-with-streaming model above.

---

## "Don't reach up" litmus (quick reference)

Before shipping a **shared** unit (the litmus is for shared primitives, not every component):

- [ ] Does it render correctly reading only **generic semantic tokens** (`--surface`, `--foreground`,
      `--accent`, `--font-body`, `--space-*`) plus its own defaults — with no dependency on any
      entry-specific token name?
- [ ] Is every themeable value exposed as a **public token** with an internal default?
- [ ] Does it avoid assuming any **themeable ambient context** (a parent's _theme_ value, a
      font mounted higher up)? Reading the global **foundation** primitives (spacing, motion) is fine —
      that's plumbing, not a look.
- [ ] If shared, is it **declared once and composed in**, never re-instantiated per slot?
- [ ] Does the host theme it **downward** (set the semantic tokens it consumes) rather than the unit
      reaching up?
- [ ] If it has a CSS Module, does that module **declare its `@layer`** (or stay strictly
      var-consuming)?
- [ ] If it registers a slot, is the key **namespaced with the entry's prefix** so a
      entry-local slot can't silently shadow a shared one?

The litmus is an **advisory** PR checklist for shared primitives; the parts that can be a lint rule
(import boundaries, `@layer` declaration) are enforced automatically, not left to human review.
