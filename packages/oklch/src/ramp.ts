/**
 * Low-level surface: build a perceptual lightness ramp for a hue.
 *
 * Part of the engine's exported low-level API (alongside the conversions, gamut map,
 * and contrast functions) so the interactive studio (#70) and any caller that wants
 * raw stops — rather than the high-level solved token set — can step lightness and
 * read measured contrast directly. Every stop is gamut-mapped. Pure, never throws.
 */

import { gamutMap, inGamut } from "./gamut";
import {
  RAMP_LABELS,
  type Gamut,
  type OkLCH,
  type Ramp,
  type RampLabel,
} from "./types";

/**
 * The lightness of each `50…950` step. NOT an even split: it is denser near the two
 * extremes (Tailwind-shaped) so the light end yields three close-spaced page/elevated
 * surfaces and the dark end yields three more for dark mode, while the mid-range spreads
 * out for accents and text. A single perceptual-lightness scale, shared by every role
 * ramp; only the chroma (and hue) differ per role/scheme. Monotonic, lightest → darkest.
 */
const RAMP_L: Record<RampLabel, number> = {
  "50": 0.985,
  "100": 0.967,
  "200": 0.922,
  "300": 0.87,
  "400": 0.708,
  "500": 0.556,
  "600": 0.439,
  "700": 0.371,
  "800": 0.269,
  "900": 0.205,
  "950": 0.145,
};

export interface RampSpec {
  /** Hue held across the ramp (the brand hue for `brand`/`neutral`, a canonical status hue). */
  hue: number;
  /** Nominal chroma held across the ramp; gamut-mapped per step, so extremes desaturate. */
  chroma: number;
  gamut: Gamut;
  /**
   * Seed anchor (#108): pin `label`'s step to lightness `L` EXACTLY and bend the rest of
   * the scale around it — a per-side shift+scale that keeps both endpoints, so the seed's
   * own color lands ON the ramp instead of drifting between steps. The engine anchors
   * only the `brand` ramp (see `palette.ts`); neutral/status ramps stay on the shared
   * scale. `L` is clamped into the scale's open interval so the ramp stays monotonic.
   */
  anchor?: { label: RampLabel; L: number };
}

/**
 * The anchored lightness of one step: linear per-side rescale of the shared `RAMP_L`
 * scale so the anchor label hits `anchor.L` exactly while `50` and `950` keep their
 * lightness (endpoints preserved → surfaces bound to the extremes are unaffected).
 * Each side is a positive-slope linear map, so step order (lightest → darkest) is
 * preserved as long as the anchor L sits inside the scale — enforced by the clamp.
 */
function anchoredL(
  label: RampLabel,
  anchor: { label: RampLabel; L: number },
): number {
  const L = RAMP_L[label];
  const La = RAMP_L[anchor.label];
  const lightEnd = RAMP_L[RAMP_LABELS[0]];
  const darkEnd = RAMP_L[RAMP_LABELS[RAMP_LABELS.length - 1]];
  // Keep the anchor strictly inside the scale so both side-spans stay positive.
  const EDGE = 0.005;
  const target = Math.min(lightEnd - EDGE, Math.max(darkEnd + EDGE, anchor.L));
  if (L >= La) {
    // Light side (incl. the anchor itself): rescale [La, lightEnd] → [target, lightEnd].
    const span = lightEnd - La || 1e-6;
    return target + (L - La) * ((lightEnd - target) / span);
  }
  // Dark side: rescale [darkEnd, La] → [darkEnd, target].
  const span = La - darkEnd || 1e-6;
  return target + (L - La) * ((target - darkEnd) / span);
}

/**
 * Build a role's `50…950` ramp — a pure perceptual-lightness primitive at a fixed hue and
 * nominal chroma. Each step is gamut-mapped (so a dark high-chroma step desaturates toward
 * the boundary, exactly as the screen paints it), and carries an `oog` flag that is true
 * when the nominal chroma exceeded the gamut at that lightness and had to be reduced.
 * Deterministic, never throws. This is the primitive the semantic tokens bind to.
 */
export function buildRamp(spec: RampSpec): Ramp {
  return RAMP_LABELS.map((label) => {
    const nominal: OkLCH = {
      L: spec.anchor ? anchoredL(label, spec.anchor) : RAMP_L[label],
      C: Math.max(0, spec.chroma),
      H: spec.hue,
    };
    return {
      label,
      color: gamutMap(nominal, spec.gamut),
      oog: !inGamut(nominal, spec.gamut),
    };
  });
}

export interface RampOptions {
  /** Number of stops (inclusive of the endpoints). Clamped to ≥ 2. */
  steps?: number;
  /** Chroma to hold across the ramp (gamut-mapped per stop). */
  chroma?: number;
  /** Lowest lightness (0–1). */
  minL?: number;
  /** Highest lightness (0–1). */
  maxL?: number;
  gamut?: Gamut;
}

/**
 * Even lightness ramp across [minL, maxL] at a fixed hue, each stop gamut-mapped to the
 * target gamut so chroma never exceeds what the screen shows. Deterministic.
 */
export function buildLightnessRamp(
  hue: number,
  opts: RampOptions = {},
): OkLCH[] {
  const steps = Math.max(2, Math.floor(opts.steps ?? 11));
  const chroma = Math.max(0, opts.chroma ?? 0.12);
  const minL = opts.minL ?? 0.05;
  const maxL = opts.maxL ?? 0.98;
  const gamut: Gamut = opts.gamut ?? "srgb";

  const ramp: OkLCH[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = minL + (maxL - minL) * t;
    ramp.push(gamutMap({ L, C: chroma, H: hue }, gamut));
  }
  return ramp;
}
