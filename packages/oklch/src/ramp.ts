/**
 * Low-level surface: build a perceptual lightness ramp for a hue.
 *
 * Part of the engine's exported low-level API (alongside the conversions, gamut map,
 * and contrast functions) so the interactive studio (#70) and any caller that wants
 * raw stops — rather than the high-level solved token set — can step lightness and
 * read measured contrast directly. Every stop is gamut-mapped. Pure, never throws.
 */

import { gamutMap } from "./gamut";
import type { Gamut, OkLCH } from "./types";

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
