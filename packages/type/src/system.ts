// The high-level entry point: `buildTypeScale(config?) → TypeScale`. Validates and merges the
// caller's config over the default, solves every step of the ramp, and NEVER THROWS — a bad
// field falls the whole config back to the default and flags `meta.isFallback`, mirroring the
// color engine's never-throw fallback stance.

import { solveStep } from "./scale";
import type { FluidStep, ScaleConfig, TypeScale } from "./types";

/**
 * The starting scale. Every value here is a design knob — NOT a load-bearing constant (the one
 * guarantee, the zoom cap, holds whatever these are set to).
 *
 * A calm editorial baseline: a fluid 16→18px body (`baseIndex` 3), a tighter minor-third (1.2) on
 * mobile so deep steps still fit, opening to a perfect-fourth (1.333) on desktop for drama. Nine
 * steps give the app room to bind roles across a generous ramp (two below body, six above).
 */
export const DEFAULT_CONFIG: ScaleConfig = {
  baseMinRem: 1,
  baseMaxRem: 1.125,
  minRatio: 1.2,
  maxRatio: 1.333,
  minVw: 320,
  maxVw: 1280,
  stepCount: 9,
  baseIndex: 3,
};

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isPositiveInt(n: unknown): n is number {
  return isFinitePositive(n) && Number.isInteger(n);
}

/**
 * A config is usable only if every field is present and sane: positive base sizes and ratios, a
 * positive viewport span with `minVw < maxVw`, a positive integer `stepCount`, and a `baseIndex`
 * that falls inside the ramp (`1 … stepCount`). Any failure discards the WHOLE config for the
 * default — partial trust is how bad data slips a `NaN` into an emitted `clamp()`.
 */
function isUsable(c: ScaleConfig): boolean {
  if (
    ![c.baseMinRem, c.baseMaxRem, c.minRatio, c.maxRatio].every(
      isFinitePositive,
    )
  ) {
    return false;
  }
  if (
    !isFinitePositive(c.minVw) ||
    !isFinitePositive(c.maxVw) ||
    c.minVw >= c.maxVw
  ) {
    return false;
  }
  if (!isPositiveInt(c.stepCount) || !isPositiveInt(c.baseIndex)) {
    return false;
  }
  return c.baseIndex <= c.stepCount;
}

/**
 * Solve the ramp. Accepts a partial config merged over `DEFAULT_CONFIG`; if the merged result is
 * unusable, the whole thing falls back to the default (`isFallback: true`). Guarded so a caller —
 * including author-time studio input — can pass anything and get a valid ramp back.
 */
export function buildTypeScale(config?: Partial<ScaleConfig>): TypeScale {
  const merged: ScaleConfig = { ...DEFAULT_CONFIG, ...config };
  const usable = isUsable(merged);

  try {
    return assemble(usable ? merged : DEFAULT_CONFIG, !usable);
  } catch {
    // Last-resort guard: any unforeseen throw returns the default ramp, never crashes a page.
    return assemble(DEFAULT_CONFIG, true);
  }
}

/** Solve every step of the ramp once and package it with its receipts. */
function assemble(config: ScaleConfig, isFallback: boolean): TypeScale {
  const steps: FluidStep[] = [];
  const zoomCappedSteps: number[] = [];
  for (let index = 1; index <= config.stepCount; index += 1) {
    // The step at `baseIndex` sits at ratio⁰ (the base size); exponent is the offset from it.
    const exponent = index - config.baseIndex;
    const step = solveStep(
      config.baseMinRem,
      config.baseMaxRem,
      config.minRatio,
      config.maxRatio,
      exponent,
      config.minVw,
      config.maxVw,
    );
    steps.push(step);
    if (step.zoomCapped) {
      zoomCappedSteps.push(index);
    }
  }
  return { steps, meta: { config, isFallback, zoomCappedSteps } };
}
