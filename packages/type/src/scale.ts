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
 * The cap pulls the CEILING (the larger of the two viewport sizes) down to `ZOOM_CAP_RATIO ×
 * floor` when it would otherwise exceed it, then rebuilds the clamp from the capped end — so the
 * emitted preferred term never lets the size run past the cap, and `zoomCapped` records that it
 * bit. A `minVw === maxVw` (or reversed) config would divide by zero / invert; callers pass a
 * validated config, but as a last defense a zero/negative span collapses to the floor constant.
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
  let startRem = modularSize(baseMinRem, minRatio, step);
  let endRem = modularSize(baseMaxRem, maxRatio, step);

  const floor = Math.min(startRem, endRem);
  const ceil = Math.max(startRem, endRem);
  const cappedCeil = Math.min(ceil, ZOOM_CAP_RATIO * floor);
  const zoomCapped = round(cappedCeil) < round(ceil);

  // Re-seat the capped ceiling onto whichever end was the larger one.
  if (endRem >= startRem) {
    endRem = cappedCeil;
  } else {
    startRem = cappedCeil;
  }

  const clamp =
    maxVw > minVw
      ? fluidClampString(startRem, endRem, minVw, maxVw)
      : `${round(floor)}rem`;

  return {
    minRem: round(floor),
    maxRem: round(cappedCeil),
    clamp,
    zoomCapped,
  };
}
