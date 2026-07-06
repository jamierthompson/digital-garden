// The Color Engine's rule state — the SINGLE source of truth for the generative rules the left
// rail exposes. Deliberately nothing invented: the four shaping rules are exactly the engine's
// `EngineRules` (#101) with all fields made REQUIRED (the Color Engine always holds a concrete
// value per rule — the defaults are ON, so the tool is usable in zero clicks), and `gamut`
// is the engine's `Gamut` axis carried alongside. `derivePalette` (derive.ts) maps this
// straight onto the engine's `EngineOptions`.

import type {
  ChromaPolicy,
  EngineRules,
  Gamut,
  HuePolicy,
  LightnessDistribution,
} from "@garden/oklch";

/**
 * The rules the Color Engine holds, as concrete values (no optionals — the UI is never in an
 * "unset" state). Structurally a `Required<EngineRules>`, so it passes straight to the
 * engine as `rules`. The `satisfies` pins it to the engine contract: if the engine adds or
 * renames a rule, this line fails to compile rather than drifting silently.
 */
export interface ColorEngineRules {
  distribution: LightnessDistribution;
  chromaPolicy: ChromaPolicy;
  huePolicy: HuePolicy;
  tintedNeutrals: boolean;
}

/**
 * The opinionated defaults — every one is the engine's documented default, so a freshly
 * mounted Color Engine reproduces the un-ruled engine output bit-for-bit (#101). "Usable in zero
 * clicks" is the product promise; these values are that promise.
 */
export const DEFAULT_RULES: ColorEngineRules = {
  distribution: "tailwind",
  chromaPolicy: "flat",
  huePolicy: "constant",
  tintedNeutrals: true,
} satisfies Required<EngineRules>;

/** The default target display gamut — the engine's safe-everywhere default (`srgb`). */
export const DEFAULT_GAMUT: Gamut = "srgb";
