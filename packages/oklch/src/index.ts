/**
 * The OKLCH theming engine — pure, isomorphic [D14] public surface.
 *
 * Two layers, per §3.2:
 *   • HIGH-LEVEL: `resolveTheme(brandColor, scheme)` and `buildTokenSet(brandColor)` —
 *     contrast-solved [D4], gamut-mapped [D6], baked-literal [D3], never-throwing [D9]
 *     token sets. `buildTokenSet` zips both schemes for `light-dark()` output [D5].
 *   • LOW-LEVEL: color conversions, gamut mapping, contrast (APCA Lc + WCAG ratio),
 *     the contrast solver, and lightness ramps — for the playground / card swatches.
 *
 * NEVER add `server-only`/`client-only` here, never import `next`/`react`/`react-dom`,
 * never touch DOM/Node globals — lint-enforced [D14].
 */

export { resolveTheme, buildTokenSet, type EngineOptions } from "./palette";

export { tokenSetToCss, tokenSetToDeclarations } from "./css";

export {
  contrastWCAG,
  contrastAPCA,
  apcaLc,
  solveForeground,
  type ContrastTarget,
  type SolveOptions,
} from "./contrast";

export { gamutMap, inGamut } from "./gamut";

export { buildLightnessRamp, type RampOptions } from "./ramp";

export {
  parseColor,
  formatOklch,
  oklchToSrgb,
  srgbToOklch,
  oklchToOklab,
  oklabToOklch,
  oklchToLinearRgb,
  clamp01,
} from "./convert";

export type {
  OkLCH,
  OkLab,
  RGB,
  Scheme,
  Gamut,
  BrandTokenName,
  SchemePair,
  SchemeTokens,
  SchemeResult,
  TokenSet,
} from "./types";
