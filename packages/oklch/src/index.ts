/**
 * The OKLCH theming engine — pure, isomorphic public surface.
 *
 * Two layers:
 *   • HIGH-LEVEL: `resolveTheme(themeColor, scheme)` and `buildTokenSet(themeColor)` —
 *     contrast-solved, gamut-mapped, baked-literal, never-throwing token sets.
 *     `buildTokenSet` zips both schemes for `light-dark()` output.
 *   • LOW-LEVEL: color conversions, gamut mapping, contrast (APCA Lc + WCAG ratio),
 *     the contrast solver, and lightness ramps — for card swatches / the studio (#70).
 *
 * This surface is DRIFT-GUARDED (#99) — an internal, single-consumer package, so it is freely
 * changeable; `api.test.ts` only catches silent drift, versioning stance in `README.md`. Portable
 * exports (Tailwind v4 `@theme`, DTCG JSON) live in `export.ts`.
 *
 * NEVER add `server-only`/`client-only` here, never import `next`/`react`/`react-dom`,
 * never touch DOM/Node globals — lint-enforced.
 */

export {
  resolveTheme,
  buildTokenSet,
  DEFAULT_BINDING_SCHEMA,
  type EngineOptions,
} from "./palette";

export { CONTRAST_TARGETS, type ContrastTargetName } from "./targets";

export {
  tokenSetToCss,
  tokenSetToDeclarations,
  rampSetToDeclarations,
  type CssOptions,
} from "./css";

export {
  tokenSetToTailwindTheme,
  tokenSetToDesignTokens,
  harmonyTierToCss,
  harmonyTierToTailwindTheme,
  harmonyTierToDesignTokens,
  type ExportOptions,
  type DesignToken,
  type DesignTokenScheme,
  type DesignTokensExport,
  type HarmonyDesignTokenGroup,
  type HarmonyDesignTokensExport,
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
  buildHarmonyTier,
  resolveHarmonyTier,
  HARMONY_HUES,
  type HarmonyHue,
  type HarmonyStepProvenance,
  type HarmonyPick,
  type HarmonyHueResult,
  type HarmonySchemeResult,
  type HarmonyPickPair,
  type HarmonyHueTier,
  type HarmonyTier,
} from "./harmony-tier";

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

export { RAMP_LABELS, RAMP_ROLES, THEME_TOKEN_NAMES } from "./types";

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
  ThemeTokenName,
  RampLabel,
  RampRole,
  RampStep,
  Ramp,
  RampPair,
  SchemePair,
  SchemeTokens,
  BindingStep,
  StepProvenance,
  FillProvenance,
  FillForegroundProvenance,
  LiteralProvenance,
  BindingProvenance,
  BindingPair,
  SchemeResult,
  TokenSet,
} from "./types";
