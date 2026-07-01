# OKLCH theming engine

A **pure, isomorphic** color engine: `brandColor → contrast-solved, gamut-mapped token
sets`, baked to literal `oklch()` values server-side. The load-bearing, genuinely hard
piece of the theming system (see `docs/architecture.md`). It knows nothing about React, the
DOM, Node, or projects — its isomorphism is lint-enforced (`eslint.config.mjs`) and
test-enforced (dual-env Vitest), and it must **never** import `next`/`react`/`react-dom`
or carry `server-only`/`client-only`.

## Decisions baked in

- **Scheme-aware** `(brandColor, scheme) → tokenSet`; dark is reduced-chroma + shifted
  surfaces with contrast **re-solved per scheme**, emitted via `light-dark()`.
- **Contrast is solved, not stepped** — APCA Lc (quality) + WCAG 2.x ratio (floor),
  binary-searched on `L` against the _relevant background_.
- **Gamut-map before contrast math** — CSS Color 4 chroma reduction, default `srgb`.
- **Bakes literals, never throws** — bad input → safe fallback palette.

## Public API (`index.ts`)

```ts
import { resolveTheme, buildTokenSet, tokenSetToCss } from "@garden/oklch";

// One scheme → flat token map (Consumer B playground, Consumer C cardSwatches):
const { tokens, seed, isFallback } = resolveTheme("#3b82f6", "light");

// Both schemes zipped for ProjectScope's light-dark() <style> (Consumer A):
const set = buildTokenSet("#3b82f6"); // { gamut: "p3" } to opt into wide gamut
const css = tokenSetToCss(set, '[data-project="garden"]'); // wrapped in @layer brand
```

Tokens (generic semantic contract, emitted as bare `--<name>`): `bg`, `surface`,
`surface-2`, `text`, `text-muted`, `border`, `accent`, `accent-text`, `on-accent`,
`focus-ring`, plus the status signals `success`, `error`, `warning`, `info`.

**Low-level surface** is also exported: `contrastWCAG`, `contrastAPCA`/`apcaLc`,
`solveForeground`, `gamutMap`/`inGamut`, `buildLightnessRamp`, and the color
conversions/parsers.

### Notes for ProjectScope / cardSwatches consumers

- The engine emits the **generic semantic** names only (bare `--surface`, `--accent`, …);
  mapping to a project alias (`--logx-*`) and to `--focus-ring-color` (foundation's
  `:focus-visible` reads that) is the **scope's** job, not the engine's. Suggested:
  `--focus-ring-color: var(--focus-ring)`.
- `tokenSetToCss` already emits `color-scheme: light dark;` so `light-dark()` resolves and
  follows `prefers-color-scheme`. Use `tokenSetToDeclarations` if you control placement.
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
