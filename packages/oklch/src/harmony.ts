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
import { FALLBACK_SEED } from "./seed";
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

/**
 * One of the 7 derived harmony hues — the design's dedupe/naming of the four relationships'
 * offsets (analogous ±30°, complementary 180°, triadic ±120°, split-complementary 150°/210°)
 * into stable, self-documenting, kebab-case keys. `-a`/`-b` disambiguate the two hues of a
 * two-sided relationship, ordered by their signed offset — the smaller (more
 * counter-clockwise) offset is `-a`: analogous −30/+30, triadic −120/+120, split 150/210.
 * These names are the public group labels of the harmony surface (`--harmony-<hue>` and the
 * `harmony-<hue>` ramp roles, #334; the export tier's `--harmony-<hue>-…` groups).
 */
export type HarmonyHue =
  | "analogous-a"
  | "analogous-b"
  | "complementary"
  | "triadic-a"
  | "triadic-b"
  | "split-complementary-a"
  | "split-complementary-b";

/** Each derived hue's parent relationship and its signed hue offset from the seed, in
 *  degrees. The single source for both the rotation math and the relationship metadata. */
export const HARMONY_HUE_ANGLES = {
  "analogous-a": { relationship: "analogous", offset: -30 },
  "analogous-b": { relationship: "analogous", offset: 30 },
  complementary: { relationship: "complementary", offset: 180 },
  "triadic-a": { relationship: "triadic", offset: -120 },
  "triadic-b": { relationship: "triadic", offset: 120 },
  "split-complementary-a": { relationship: "split-complementary", offset: 150 },
  "split-complementary-b": { relationship: "split-complementary", offset: 210 },
} as const satisfies Record<
  HarmonyHue,
  { relationship: HarmonyKind; offset: number }
>;

/** The canonical harmony-hue order, exported for the studio's display (mirrors
 *  `HARMONY_KINDS`). Insertion order of `HARMONY_HUE_ANGLES` = relationship order. */
export const HARMONY_HUES = Object.keys(HARMONY_HUE_ANGLES) as HarmonyHue[];

/** The full decorative palette: per relationship, the derived colors in offset order. */
export type HarmonyPalette = Record<HarmonyKind, OkLCH[]> & {
  /** The parsed, gamut-mapped seed the sets rotate around. */
  seed: OkLCH;
  /** True when the input failed to parse and the fallback seed was used. */
  isFallback: boolean;
};

export interface HarmonyOptions {
  /** Target display gamut. Defaults to `srgb`, like the rest of the engine. */
  gamut?: Gamut;
}

/** Rotate a hue by `delta` degrees, normalized into [0, 360). */
export function rotate(hue: number, delta: number): number {
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
