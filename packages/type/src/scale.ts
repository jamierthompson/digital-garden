// The math — pure functions, no config validation (that's `system.ts`'s job). Two ideas:
// a modular scale (geometric: size = base · ratio^step) and Utopia-style fluid interpolation
// (a per-step `clamp()` between a small-viewport size and a large-viewport size). The load-
// bearing piece is the ZOOM CAP.

import type { FluidStep } from "./types";

/**
 * The rem→px basis for the zoom-cap comparison and the slope math. This is the reference root
 * size the fluid formula assumes; the emitted values are rem, so a user's own root-size zoom
 * still scales everything — the constant only fixes the vw↔rem conversion, not the output unit.
 */
const ROOT_PX = 16;

/**
 * The per-step zoom ceiling: a step's max rendered size may be at most this multiple of its min.
 *
 * WHY (WCAG 1.4.4, the engine's load-bearing guarantee): a fluid `clamp()` fights full-page zoom
 * — zoom scales `rem` but SHRINKS the CSS viewport, so the `vw` term works against the user. The
 * reachable apparent maximum within the browser's ~500% zoom ceiling collapses, in the worst
 * case, to `5 × minPx`; requiring 200% of the largest rendered size to stay reachable reduces to
 * `maxPx ≤ 2.5 × minPx` per step. We enforce **2.4** — a margin under the theoretical 2.5 — and
 * FLAG any step the cap bites (`zoomCapped`). Solved and capped, never eyeballed.
 */
export const ZOOM_CAP_RATIO = 2.4;

/** Rounding for emitted values — full precision through the math, rounded only at the string. */
function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  // `+ 0` normalizes -0 to 0 so the emitted string never reads "-0rem".
  return Math.round(n * f) / f + 0;
}

/** Round toward zero to `dp` places — used for the zoom cap so the EMITTED ceiling can never
 *  exceed the limit (rounding the cap to nearest could nudge it back over). */
function roundDown(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.floor(n * f) / f + 0;
}

/** A modular-scale size in rem: `base · ratio^step`. Non-integer steps are valid. */
export function modularSize(
  baseRem: number,
  ratio: number,
  step: number,
): number {
  return baseRem * ratio ** step;
}

/**
 * Build the fluid `clamp()` for a step given its size at each viewport end. The two sizes are
 * ordered into a floor and a ceiling first, because a sub-body step SHRINKS as the viewport
 * grows (its large-viewport size is the SMALLER of the two) — the clamp's first arg must be the
 * smaller value and its last the larger, whichever end each falls on.
 *
 * `slope` (rem-per-px) can be negative (sub-body steps); the `vw` coefficient carries the sign,
 * so the preferred term interpolates the right direction between an ordered floor and ceiling.
 * When the two ends are equal (e.g. body with a non-fluid base) the clamp collapses to a
 * constant rem — no degenerate `x rem + 0vw`.
 */
export function fluidClampString(
  startRem: number,
  endRem: number,
  minVw: number,
  maxVw: number,
): string {
  const floor = Math.min(startRem, endRem);
  const ceil = Math.max(startRem, endRem);

  if (round(floor) === round(ceil)) {
    return `${round(floor)}rem`;
  }

  const startPx = startRem * ROOT_PX;
  const endPx = endRem * ROOT_PX;
  const slopePxPerPx = (endPx - startPx) / (maxVw - minVw);
  const interceptPx = startPx - slopePxPerPx * minVw;

  const interceptRem = round(interceptPx / ROOT_PX);
  // `1vw` = 1% of the viewport, so the vw coefficient is the px-per-px slope × 100.
  const vwCoeff = round(slopePxPerPx * 100);

  const preferred =
    vwCoeff >= 0
      ? `${interceptRem}rem + ${vwCoeff}vw`
      : `${interceptRem}rem - ${Math.abs(vwCoeff)}vw`;

  return `clamp(${round(floor)}rem, ${preferred}, ${round(ceil)}rem)`;
}

/**
 * Solve one step of the scale into a ready-to-emit `FluidStep`, with the zoom cap applied.
 *
 * The cap holds on the EMITTED (rounded) values, not the full-precision ones: `minRem` rounds the
 * floor, and the ceiling is capped at `ZOOM_CAP_RATIO × minRem` then rounded DOWN — so
 * `maxRem ≤ ZOOM_CAP_RATIO × minRem` is guaranteed after rounding, closing the leak where
 * independent 4-dp rounding of two full-precision bounds could nudge the ratio back over. The
 * clamp is then built from those same emitted bounds (placed at their viewport ends) so its
 * displayed floor/ceil match `minRem`/`maxRem` exactly. `zoomCapped` records that the cap bit. A
 * `minVw === maxVw` (or reversed) span collapses to the floor constant. Overflow/underflow (a
 * non-finite or zero emitted size from an extreme config) is left for `buildTypeScale` to detect
 * and fall back on — this function stays pure math.
 */
export function solveStep(
  baseMinRem: number,
  baseMaxRem: number,
  minRatio: number,
  maxRatio: number,
  step: number,
  minVw: number,
  maxVw: number,
): FluidStep {
  const startRem = modularSize(baseMinRem, minRatio, step);
  const endRem = modularSize(baseMaxRem, maxRatio, step);

  const floor = Math.min(startRem, endRem);
  const ceil = Math.max(startRem, endRem);

  const minRem = round(floor);
  const roundedCeil = round(ceil);
  // Cap derived from the ROUNDED floor and floored to 4-dp: `maxRem ≤ ZOOM_CAP_RATIO × minRem`.
  const maxRem = Math.min(roundedCeil, roundDown(ZOOM_CAP_RATIO * minRem));
  const zoomCapped = maxRem < roundedCeil;

  // Position the emitted bounds at their viewport ends, then build the clamp from them. Rounding
  // is idempotent on already-4-dp values, so the clamp's floor/ceil equal minRem/maxRem exactly —
  // the preferred term never interpolates past the capped ceiling.
  const growing = endRem >= startRem;
  const atMinVw = growing ? minRem : maxRem;
  const atMaxVw = growing ? maxRem : minRem;

  const clamp =
    maxVw > minVw
      ? fluidClampString(atMinVw, atMaxVw, minVw, maxVw)
      : `${minRem}rem`;

  return { minRem, maxRem, clamp, zoomCapped };
}
