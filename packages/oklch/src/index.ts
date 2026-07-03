/**
 * The OKLCH theming engine — pure, isomorphic public surface.
 *
 * Two layers:
 *   • HIGH-LEVEL: `resolveTheme(brandColor, scheme)` and `buildTokenSet(brandColor)` —
 *     contrast-solved, gamut-mapped, baked-literal, never-throwing token sets.
 *     `buildTokenSet` zips both schemes for `light-dark()` output.
 *   • LOW-LEVEL: color conversions, gamut mapping, contrast (APCA Lc + WCAG ratio),
 *     the contrast solver, and lightness ramps — for card swatches / the studio (#70).
 *
 * This surface is FROZEN (#99) — guarded by `api.test.ts`, versioning stance in
 * `README.md`. Portable exports (Tailwind v4 `@theme`, DTCG JSON) live in `export.ts`.
 *
 * NEVER add `server-only`/`client-only` here, never import `next`/`react`/`react-dom`,
 * never touch DOM/Node globals — lint-enforced.
 */

export { resolveTheme, buildTokenSet, type EngineOptions } from "./palette";

export {
  tokenSetToCss,
  tokenSetToDeclarations,
  rampSetToDeclarations,
  type CssOptions,
} from "./css";

export {
  tokenSetToTailwindTheme,
  tokenSetToDesignTokens,
  type ExportOptions,
  type DesignToken,
  type DesignTokenScheme,
  type DesignTokensExport,
} from "./export";

export {
  contrastWCAG,
  contrastAPCA,
  apcaLc,
  checkContrast,
  solveForeground,
  type ContrastCheck,
  type ContrastTarget,
  type SolveOptions,
} from "./contrast";

export { gamutMap, inGamut } from "./gamut";

export {
  buildLightnessRamp,
  buildRamp,
  type RampOptions,
  type RampSpec,
} from "./ramp";

export { minPass, type TokenBinding } from "./binding";

export {
  buildHarmonyPalette,
  HARMONY_KINDS,
  type HarmonyKind,
  type HarmonyPalette,
  type HarmonyOptions,
} from "./harmony";

export {
  parseColor,
  formatOklch,
  formatHex,
  formatRgb,
  formatColor,
  oklchToSrgb,
  srgbToOklch,
  oklchToOklab,
  oklabToOklch,
  oklchToLinearRgb,
  clamp01,
} from "./convert";

export { RAMP_LABELS, RAMP_ROLES, BRAND_TOKEN_NAMES } from "./types";

export type {
  OkLCH,
  OkLab,
  RGB,
  Scheme,
  Gamut,
  ColorFormat,
  LightnessDistribution,
  ChromaPolicy,
  HuePolicy,
  RampRules,
  EngineRules,
  BrandTokenName,
  RampLabel,
  RampRole,
  RampStep,
  Ramp,
  RampPair,
  SchemePair,
  SchemeTokens,
  SchemeResult,
  TokenSet,
} from "./types";
