/**
 * The expressive accent-harmony palette (#102): decorative hue sets in mathematical
 * harmony with the seed — analogous, complementary, triadic, split-complementary — for
 * charts, gradients, and secondary accents.
 *
 * DECORATIVE, not semantic: these are non-contrast-bearing by default and deliberately
 * separate from the semantic tokens and the canonical-hue status colors (error stays red
 * — a usability requirement, #66). Where a harmony color backs text, the CONSUMER runs
 * it through `checkContrast` (or solves with `solveForeground`) against its actual
 * background — the same contrast-validation surface everything else uses (#100).
 *
 * Every color holds the seed's own lightness and chroma and rotates only the hue, then
 * gamut-maps — so the set reads as one family, painted exactly as the screen shows it.
 * Defensive like the rest of the engine: unparseable input falls back, never throws.
 */

import { parseColor } from "./convert";
import { gamutMap } from "./gamut";
import type { Gamut, OkLCH } from "./types";

/** The harmony relationships the engine emits, and their hue offsets in degrees. */
const HARMONY_ANGLES = {
  /** Neighbors on the wheel — calm, adjacent accents. */
  analogous: [-30, 30],
  /** The opposite hue — maximum hue tension. */
  complementary: [180],
  /** Two hues at even thirds — balanced, vivid triads. */
  triadic: [-120, 120],
  /** The complementary's neighbors — the tension without the head-on clash. */
  "split-complementary": [150, 210],
} as const satisfies Record<string, readonly number[]>;

/** One harmony relationship. */
export type HarmonyKind = keyof typeof HARMONY_ANGLES;

/** The canonical relationship order, exported for the Studio's display (#73). */
export const HARMONY_KINDS = Object.keys(HARMONY_ANGLES) as HarmonyKind[];

/** The full decorative palette: per relationship, the derived colors in offset order. */
export type HarmonyPalette = Record<HarmonyKind, OkLCH[]> & {
  /** The parsed, gamut-mapped seed the sets rotate around. */
  seed: OkLCH;
  /** True when the input failed to parse and the fallback seed was used. */
  isFallback: boolean;
};

/** Fallback seed for unparseable input — mirrors `palette.ts`'s calm slate-blue. */
const FALLBACK_SEED: OkLCH = { L: 0.55, C: 0.11, H: 264 };

export interface HarmonyOptions {
  /** Target display gamut. Defaults to `srgb`, like the rest of the engine. */
  gamut?: Gamut;
}

/** Rotate a hue by `delta` degrees, normalized into [0, 360). */
function rotate(hue: number, delta: number): number {
  return (((hue + delta) % 360) + 360) % 360;
}

/**
 * Build the decorative accent-harmony palette from a theme color (#102). Each derived
 * color keeps the seed's L and C and rotates the hue by the relationship's angles,
 * gamut-mapped into the target gamut. Pure, deterministic, never throws.
 */
export function buildHarmonyPalette(
  themeColor: unknown,
  opts: HarmonyOptions = {},
): HarmonyPalette {
  const gamut: Gamut = opts?.gamut ?? "srgb";
  const parsed = parseColor(themeColor);
  const isFallback = parsed === null;
  const seed = gamutMap(parsed ?? FALLBACK_SEED, gamut);

  const sets = Object.fromEntries(
    HARMONY_KINDS.map((kind) => [
      kind,
      HARMONY_ANGLES[kind].map((delta) =>
        gamutMap({ L: seed.L, C: seed.C, H: rotate(seed.H, delta) }, gamut),
      ),
    ]),
  ) as Record<HarmonyKind, OkLCH[]>;

  return { ...sets, seed, isFallback };
}
