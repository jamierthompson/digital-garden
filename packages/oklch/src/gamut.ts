/**
 * Gamut mapping — applied BEFORE contrast math so contrast is solved against the
 * color the screen actually shows.
 *
 * Realization choice: the CSS Color 4 "MINDE" algorithm — binary-search chroma
 * reduction toward the gamut boundary, keeping L and H, with a small ΔEOK check and a
 * final clip (https://www.w3.org/TR/css-color-4/#binsearch). This is exactly what a
 * browser does when it renders an out-of-gamut `oklch()` literal, so by mapping with
 * the same algorithm server-side and baking the mapped literal, what we solve
 * contrast on is what the browser paints. It is cusp-aware in effect (chroma reduces
 * toward the per-hue boundary) — the concrete, browser-faithful form of an
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
 * Memo of `gamutMap` results, keyed by the exact `(L, C, H, gamut)` (#41). The engine calls
 * `gamutMap` with heavily-REPEATED inputs — most of all since #153, whose accent co-solve
 * scans a fixed `(seed.C, seed.H)` across a lightness grid on EVERY solve, so the same
 * out-of-gamut binary search recurs across ramp builds, schemes, and (in the rules
 * cross-product) all policy combinations of a fixed seed. This turns those repeats into a
 * lookup. BIT-IDENTICAL by construction: a hit returns exactly what a fresh compute would for
 * the same deterministic inputs, so it is a transparent memo of a pure function — no observable
 * behavior changes. Bounded (a long-running process solving many distinct seeds cannot grow it
 * without limit); a full clear on overflow is safe because every value is recomputable.
 * Isomorphic (a plain Map), no deps.
 */
const GAMUT_CACHE = new Map<string, OkLCH>();
const GAMUT_CACHE_MAX = 100_000;

/**
 * Map an OKLCH color into the target gamut by reducing chroma (L, H fixed), per the
 * CSS Color 4 binary-search algorithm. Returns an in-gamut OKLCH; `alpha` rides through
 * untouched (a serialization concern — `types.ts`). Deterministic and
 * observably pure, never throws — but INTERNALLY MEMOIZED (#41; see `GAMUT_CACHE`) so a
 * repeated `(L, C, H, gamut)` is a lookup instead of a re-search. Every returned result is
 * bit-identical to a fresh compute (`computeGamutMap`, the cache-miss path below).
 */
export function gamutMap(color: OkLCH, gamut: Gamut): OkLCH {
  const key = `${color.L}|${color.C}|${color.H}|${gamut}`;
  let value = GAMUT_CACHE.get(key);
  if (value === undefined) {
    value = computeGamutMap(color, gamut);
    // Bounded: a full clear on overflow keeps memory flat and stays correct (recomputable).
    if (GAMUT_CACHE.size >= GAMUT_CACHE_MAX) GAMUT_CACHE.clear();
    GAMUT_CACHE.set(key, value);
  }
  // Hand back a FRESH copy every call — never the cached canonical object. The engine treats
  // colors as immutable, but `gamutMap` is public (`index.ts`): an external consumer owns and
  // may mutate what it gets back, and `computeGamutMap`'s in-gamut path never returns the
  // caller's input (below), so the cache can hold no caller-owned reference either. Together
  // that keeps the memo a truly transparent, bit-identical optimization — a mutated result can
  // never poison a later hit. One tiny allocation, dwarfed by the binary search it replaces.
  // The input's alpha is reattached verbatim on the way out: the map itself is pure L/C/H
  // (alpha can't affect it), so the memo stays keyed — and cached — alpha-free.
  return color.alpha === undefined
    ? { L: value.L, C: value.C, H: value.H }
    : { L: value.L, C: value.C, H: value.H, alpha: color.alpha };
}

/** The CSS Color 4 binary-search map itself — the `gamutMap` cache-miss path. */
function computeGamutMap(color: OkLCH, gamut: Gamut): OkLCH {
  // Trivial extremes: pure black/white are always in gamut.
  if (color.L <= 0) return { L: 0, C: 0, H: color.H };
  if (color.L >= 1) return { L: 1, C: 0, H: color.H };
  // Already in gamut → a fresh copy of the input (NOT the input itself, so the memo above can
  // never cache — and later hand out — a reference the caller still owns and might mutate).
  if (inGamut(color, gamut)) return { L: color.L, C: color.C, H: color.H };

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
