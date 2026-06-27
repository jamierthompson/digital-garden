/**
 * Gamut mapping — applied BEFORE contrast math [D6] so contrast is solved against the
 * color the screen actually shows.
 *
 * Realization choice: the CSS Color 4 "MINDE" algorithm — binary-search chroma
 * reduction toward the gamut boundary, keeping L and H, with a small ΔEOK check and a
 * final clip (https://www.w3.org/TR/css-color-4/#binsearch). This is exactly what a
 * browser does when it renders an out-of-gamut `oklch()` literal, so by mapping with
 * the same algorithm server-side and baking the mapped literal [D3], what we solve
 * contrast on is what the browser paints. It is cusp-aware in effect (chroma reduces
 * toward the per-hue boundary) — the concrete, browser-faithful form of [D6]'s
 * "Ottosson-style chroma reduction toward the boundary."
 */

import {
  linearSrgbToOklab,
  oklabToOklch,
  oklchToLinearRgb,
  oklchToOklab,
} from "./convert";
import type { Gamut, OkLab, OkLCH, RGB } from "./types";

/** Channel tolerance for "in gamut" — guards floating-point noise at the boundary. */
const EPSILON = 1e-4;
/** ΔEOK just-noticeable-difference threshold from the CSS Color 4 algorithm. */
const JND = 0.02;

/** Is every linear channel within [0,1] (± epsilon) for the target gamut? */
export function inGamut(color: OkLCH, gamut: Gamut): boolean {
  const { r, g, b } = oklchToLinearRgb(color, gamut);
  return (
    r >= -EPSILON &&
    r <= 1 + EPSILON &&
    g >= -EPSILON &&
    g <= 1 + EPSILON &&
    b >= -EPSILON &&
    b <= 1 + EPSILON
  );
}

/** Clip linear channels into [0,1]. */
function clipLinear({ r, g, b }: RGB): RGB {
  return {
    r: Math.min(1, Math.max(0, r)),
    g: Math.min(1, Math.max(0, g)),
    b: Math.min(1, Math.max(0, b)),
  };
}

/** ΔEOK — Euclidean distance in OKLab between two colors. */
function deltaEOK(a: OkLab, b: OkLab): number {
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

/**
 * OKLab of clipped linear channels. Measured through the sRGB OKLab basis (round-trip
 * gamma → linear → OKLab). Exact for sRGB; for P3 it is a close approximation used only
 * for the sub-JND boundary acceptance, where the residual error is imperceptible.
 */
function clippedOklab(linear: RGB): OkLab {
  return linearSrgbToOklab(clipLinear(linear));
}

/**
 * Map an OKLCH color into the target gamut by reducing chroma (L, H fixed), per the
 * CSS Color 4 binary-search algorithm. Returns an in-gamut OKLCH. Pure, never throws.
 */
export function gamutMap(color: OkLCH, gamut: Gamut): OkLCH {
  // Trivial extremes: pure black/white are always in gamut.
  if (color.L <= 0) return { L: 0, C: 0, H: color.H };
  if (color.L >= 1) return { L: 1, C: 0, H: color.H };
  if (inGamut(color, gamut)) return color;

  let lo = 0;
  let hi = color.C;
  let current: OkLCH = { L: color.L, C: 0, H: color.H };

  // Binary-search the largest chroma whose clipped form is within one JND.
  while (hi - lo > 1e-5) {
    const mid = (lo + hi) / 2;
    const candidate: OkLCH = { L: color.L, C: mid, H: color.H };

    if (inGamut(candidate, gamut)) {
      lo = mid;
      current = candidate;
      continue;
    }

    const clipped = clipLinear(oklchToLinearRgb(candidate, gamut));
    if (deltaEOK(clippedOklab(clipped), oklchToOklab(candidate)) < JND) {
      current = candidate;
      break;
    }
    hi = mid;
  }

  return clampToGamut(current, gamut);
}

/** Clip a near-in-gamut color, returning an exactly in-gamut OKLCH. */
function clampToGamut(color: OkLCH, gamut: Gamut): OkLCH {
  if (inGamut(color, gamut)) return color;
  const clipped = clipLinear(oklchToLinearRgb(color, gamut));
  const derived = oklabToOklch(clippedOklab(clipped));
  return {
    L: derived.L,
    C: derived.C,
    H: Number.isFinite(derived.H) ? derived.H : color.H,
  };
}
