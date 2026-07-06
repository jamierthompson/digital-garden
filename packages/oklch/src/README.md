# OKLCH theming engine

A **pure, isomorphic** color engine: `brandColor → contrast-solved, gamut-mapped token
sets`, baked to literal `oklch()` values server-side. The load-bearing, genuinely hard
piece of the theming system (see `docs/architecture.md`). It knows nothing about React, the
DOM, Node, or projects — its isomorphism is lint-enforced (`eslint.config.mjs`) and
test-enforced (dual-env Vitest), and it must **never** import `next`/`react`/`react-dom`
or carry `server-only`/`client-only`.

"Pure" here means **deterministic and observably side-effect-free** to callers, not
allocation-free: `gamutMap` is **internally memoized** (#41 — a bounded module-level cache
keyed by exact `(L, C, H, gamut)`) so the interactive Studio's repeated re-solves stay
cheap. The memo is a transparent optimization of a pure function — every result is
bit-identical to a fresh compute — so the purity/determinism contract is unchanged.

## Decisions baked in

- **Ramp primitive + bound semantic tokens.** The engine emits a per-role generative ramp
  — `brand`, `neutral`, and the four status ramps — as **11 `50…950` steps** (a pure
  perceptual-lightness primitive, gamut-mapped, with an out-of-gamut flag per step), and the
  semantic tokens **bind to ramp steps**: surfaces pin a fixed neutral step per scheme, and
  every readable-on-surface token binds to the _smallest step that clears_ its contrast target
  (`minPass`, with an extreme-step fallback). The accent **fill** is the exception — a faithful
  continuous solve anchored at the seed's lightness — with its on-accent label the **most
  chromatic** color at the brand hue that clears on the fill (#153 — gold on navy, degrading to
  a near-white/near-black extreme when the gamut allows no chroma there). Consumers read the generic semantic **names**;
  the ramp math stays behind them (the raw `--<role>-<step>` steps are emitted too).
- **Seed anchor-step.** The **brand** ramp is bent so one step sits at the seed's **exact**
  lightness (a per-side shift+scale that preserves the endpoints, keeps the scale strictly
  monotonic, and happens _before_ gamut mapping) — the seed's own color lands **on** the ramp
  instead of drifting between steps, and in the native scheme the accent fill IS that step
  _whenever the seed's own lightness can host a legible on-accent label_ (a label-hostile
  mid-tone seed falls back to the co-solve's minimal nudge, diverging from the step — by
  design). Fully automatic: the step is keyed off the seed's native direction (`500`
  light-native, `300` dark-native) and reported as `anchorLabel` (`SchemeResult` /
  `TokenSet.meta`). A near-white/near-black seed's L is clamped just inside the scale
  (~0.15…0.98), so its pin is close-to rather than exact. Under a non-`flat` **chroma
  policy** the pin is **lightness-only** — the anchored step's chroma follows the policy's
  curve like every other step, so full seed-color fidelity holds under the default `flat`
  policy (QA-101). Neutral/status ramps stay on the scheme's own scale.
- **Brand-harmony palette** (`buildHarmonyPalette`, #102): decorative hue sets in
  mathematical harmony with the seed — analogous (±30°), complementary (180°), triadic
  (±120°), split-complementary (150°/210°) — each at the seed's own L/C, gamut-mapped, for
  charts/gradients/secondary accents. **Decorative, not semantic**: kept apart from the
  token contract and the canonical-hue status colors, and **non-contrast-bearing by
  default** — a consumer that puts text on one runs `checkContrast` (or `solveForeground`)
  itself.
- **Generative rules** (`EngineOptions.rules`, surfaced by the Studio #73): **lightness
  distribution** (`tailwind` default · `linear` · `eased` · `punchy` · `soft`) reshapes only
  the scheme's **text-zone interior** — the five **surface** steps and the far text-extreme
  step are **pinned**, which is what keeps every contrast guarantee intact under every policy
  (a floated surface a distribution darkens into a mid-tone can host no body text at Lc 75);
  **chroma policy** (`flat` default · `taper` · `hold`); **hue policy** (`constant` default ·
  `warm-shadows` · `cool-highlights`, ±9° drift); **tinted neutrals** (default `true`;
  `false` = pure achromatic greys). Every default reproduces the un-ruled output bit-for-bit.
- **Scheme-aware, independent per-scheme scales** (#160): `(brandColor, scheme) →
{ ramps, tokens }`. Light and dark are **not** a mirror-label flip of one shared scale —
  each has its **own** lightness distribution (surfaces reserved at its own end: light `50…400`,
  dark `600…950`) and its own neutral chroma, so dark neutrals read clean rather than muddy.
  Dark **re-generates** each ramp (reduced chroma) and **re-solves** every binding against
  dark's own surfaces — foregrounds against the worst-case surface `surface-selected` — emitted
  via `light-dark()`.
- **Contrast is solved, not stepped** — APCA Lc (quality) + WCAG 2.x ratio (floor), solved
  against the _relevant background_ (binary-searched on `L` for the accent co-solve; the
  smallest passing ramp step for the bound tokens).
- **Gamut-map before contrast math** — CSS Color 4 chroma reduction, default `srgb`.
- **Bakes literals, never throws** — bad input → safe fallback palette.

## Public API (`index.ts`)

```ts
import { resolveTheme, buildTokenSet, tokenSetToCss } from "@garden/oklch";

// One scheme → { ramps, tokens, seed, isFallback } (cardSwatches; the studio, #70):
const { ramps, tokens, seed, isFallback } = resolveTheme("#3b82f6", "light");
ramps.brand[7]; // → { label: "700", color: {…}, oog: false }

// Both schemes zipped for EntryScope's light-dark() <style>:
const set = buildTokenSet("#3b82f6"); // { gamut: "p3" } to opt into wide gamut
const css = tokenSetToCss(set, '[data-entry="garden"]'); // @layer brand, tokens + ramps
```

Tokens (generic semantic contract, emitted as bare `--<name>`) — the **34-token** model
(#160): the core 10 (`bg`, `surface`, `surface-2`, `text`, `text-muted`, `border`, `accent`,
`accent-text`, `on-accent`, `focus-ring`); a status **trio + container** block ×4
(`error`/`warning`/`success`/`info` × `<status>` fill · `on-<status>` label · `<status>-text` ·
`<status>-container` · `on-<status>-container`); the interaction states `accent-hover`,
`surface-hover`, `surface-selected`; and the translucent `scrim` overlay literal. The canonical
lists are exported (`BRAND_TOKEN_NAMES`, `RAMP_ROLES`, `RAMP_LABELS`) — import them, don't
restate them.

Ramps (the primitive tier, emitted as `--<role>-<step>`): one per role — `brand`, `neutral`,
`success`, `error`, `warning`, `info` — each 11 `50…950` steps (`RampStep` = `{ label, color,
oog }`). `tokenSetToDeclarations` emits the semantic tier only; `rampSetToDeclarations` the
ramp tier only; `tokenSetToCss` both.

Binding provenance (the receipt): each result reports **which ramp step every semantic token
bound to**, so a consumer (the Studio token table, #70) can print a truthful "`--text` →
`neutral · 800`" without reverse-engineering it by value-matching — a scan that _lies_ where
the brand and neutral ramps converge (an achromatic seed, `tintedNeutrals: false`) and scan
order, not the schema, would pick the role. `SchemeResult.bindings` is
`Record<BrandTokenName, BindingProvenance>` for that scheme; `TokenSet.meta.bindings` is
`Record<BrandTokenName, BindingPair>` (`{ light, dark }`). `BindingProvenance` is a
discriminated union on `kind` (generalized #160 — the kind is the derivation SHAPE, `role`
carries the identity so a status fill's receipt never says "accent"): `StepProvenance`
(`{ kind: "step", role, label }`) for a discrete ramp step (surfaces, every `auto` token,
containers, state steps); `FillProvenance` (`{ kind: "fill", role, hue, seed }`) for a
co-solved fill (the brand `accent`/`accent-hover` — `seed` non-null with the faithful/nudged/
derived story — and every status fill — `seed: null`, fixed canonical hue); `OnFillProvenance`
(`{ kind: "on-fill", role, pole, hue, chroma, backedOff }`) for a chromatic label on a fill
(`on-accent`, `on-<status>`); and `LiteralProvenance` (`{ kind: "literal", alpha }`) for a
fixed value (scrim — no contrast claim, only opacity). `null` is a reserved sentinel. It is
**reporting, not re-solving** — every baked color is byte-identical with or without it.

The derivation contract (the receipt's other half, #150): `CONTRAST_TARGETS` — the named
tiers each pair is measured against (`bodyText` 4.5/75, `mutedText`/`accentText`/`onAccent`
4.5/60, `ui` 3/45, `border` 3/30) — and `DEFAULT_BINDING_SCHEMA`, the read-only
`Record<BrandTokenName, TokenBinding>` the engine solves against. Together they let the
Studio answer, for any token, WHICH binding kind it is (`step`/`auto`/`accent`/`on-accent`/
`literal`), against WHICH role's ramp, to WHICH tier — reading the solver's own table rather
than restating it. Each `auto` binding's `target` is a `CONTRAST_TARGETS` object by identity,
so the receipt's target and the solver's are one value. `ContrastTargetName` names the tiers.

### The drift-guarded surface & versioning stance (#99)

`@garden/oklch` is an internal, project-only package — digital-garden is its **only** consumer —
so its public surface (the runtime export names, the canonical name lists above, the
custom-property names the serializers emit, and the high-level signatures) is **freely changeable**,
up to a major-version bump for a new feature. `api.test.ts` guards it only against **silent,
uncoordinated** drift, not against change: when that test fails, the surface changed, and that is
fine as long as it was deliberate and the guard is updated in the same PR.

- **Additions are fine** (new export, new token) — extend the drift-guard's lists in the
  same commit, and update this README.
- **Renames/removals are breaking** — migrate every consumer (`EntryScope`,
  `cardSwatches`, Studio validation, the studio module) in the same PR. There is no
  deprecation window inside a monorepo; the PR is the migration.
- Never adjust the guard to make accidental drift pass.

### Export formats (for the studio export UI, #107)

Portable serializations of a `TokenSet`, each taking `{ format?: "oklch" | "hex" | "rgb" }`
(default `oklch`, the native lossless literal; `hex`/`rgb` are the clamped sRGB rendering):

```ts
import { tokenSetToTailwindTheme, tokenSetToDesignTokens } from "@garden/oklch";

tokenSetToTailwindTheme(set); // Tailwind v4 `@theme { --color-brand-500: …; }` (CSS-first)
tokenSetToDesignTokens(set, { format: "hex" }); // W3C-DTCG JSON, per-scheme groups
```

The in-repo CSS serializers (`tokenSetToCss` & co.) take the same option; `EntryScope`
uses the default.

**Low-level surface** is also exported: `contrastWCAG`, `contrastAPCA`/`apcaLc`,
`checkContrast` (the shared "does it clear?" report — measured WCAG + APCA + `passes`,
the one predicate every solve and binding routes through, #100), `solveForeground`,
`gamutMap`/`inGamut`, `buildRamp` (the `50…950` role ramp) + `buildLightnessRamp` (raw
stops), `minPass` (discrete step binding), and the color conversions/parsers.

### Notes for EntryScope / cardSwatches consumers

- The engine emits the **generic semantic** names only (bare `--surface`, `--accent`, …) —
  there are no project-prefixed aliases (isolation comes from the `[data-entry]` scope).
  Mapping to `--focus-ring-color` (foundation's `:focus-visible` reads that) is the
  **scope's** job, not the engine's. Suggested: `--focus-ring-color: var(--focus-ring)`.
- **`color-scheme` is NOT emitted by default (#159).** `color-scheme` is inherited, so a
  scoped `[data-entry]` slot must let it fall through from the foundation `:root` — otherwise
  re-declaring `light dark` shadows a forced root override (the site-wide light/dark toggle)
  and the slot silently follows the OS. The foundation layer establishes it once at `:root`.
  A caller that establishes the scheme at its OWN root — e.g. the pasteable `:root` CSS export
  (#107) — opts in with `tokenSetToCss(set, ":root", { colorScheme: true })`.
- `resolveTheme(...).isFallback` / `buildTokenSet(...).meta.isFallback` is `true` when the
  input failed to parse — surface it if you want a visible signal; the palette is always safe.

## Visual contrast harness

`harness/harness.test.ts` is the **exit criterion**: it asserts measured APCA Lc + WCAG
ratios for 5 hue-spanning brand colors (incl. the **yellow & cyan stressers**), in **both
schemes**, on every text-on-surface and on-brand pair _after_ gamut mapping. It also
regenerates **`harness/swatches.html`** — a committed, deterministic eyeball artifact.

```bash
# Assert the numbers (runs in both node + jsdom):
pnpm exec vitest run packages/oklch/src/harness

# Then open the regenerated swatches in a browser to eyeball palette quality:
open packages/oklch/src/harness/swatches.html
```

## Tests

```bash
pnpm exec vitest run packages/oklch                 # whole engine, both envs
pnpm exec vitest run --project node packages/oklch  # isomorphism (node only)
```
