import { describe, expect, it } from "vitest";

import { inGamut } from "./gamut";
import { buildLightnessRamp } from "./ramp";

/** Brand-ish hues spanning the wheel, incl. the yellow/cyan stressers. */
const HUES = [29, 110, 145, 195, 260, 330];

describe("buildLightnessRamp", () => {
  it("returns exactly `steps` stops", () => {
    expect(buildLightnessRamp(260, { steps: 7 })).toHaveLength(7);
    expect(buildLightnessRamp(260, { steps: 2 })).toHaveLength(2);
  });

  it("defaults to 11 stops across the documented [0.05, 0.98] span", () => {
    const ramp = buildLightnessRamp(195);
    expect(ramp).toHaveLength(11);
    // Endpoints honor the default span; the gamut map may nudge L by a hair at the
    // extremes (its final clip step), so allow a small tolerance for that drift.
    expect(Math.abs(ramp[0].L - 0.05)).toBeLessThan(0.02);
    expect(Math.abs(ramp[ramp.length - 1].L - 0.98)).toBeLessThan(0.02);
  });

  it("lands its endpoints exactly on minL and maxL (neutral, no gamut drift)", () => {
    // chroma 0 is in gamut at every lightness, so the mapper returns L untouched —
    // isolating the ramp's lightness math (t=0 → minL, t=1 → maxL) from gamut nudging.
    const ramp = buildLightnessRamp(110, {
      steps: 9,
      chroma: 0,
      minL: 0.1,
      maxL: 0.9,
    });
    expect(ramp[0].L).toBeCloseTo(0.1, 10);
    expect(ramp[ramp.length - 1].L).toBeCloseTo(0.9, 10);
  });

  it("steps lightness monotonically up across the span", () => {
    const ramp = buildLightnessRamp(330, { steps: 6, minL: 0.2, maxL: 0.8 });
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].L).toBeGreaterThan(ramp[i - 1].L);
    }
  });

  it("gamut-maps every stop into sRGB, even at high chroma", () => {
    for (const H of HUES) {
      const ramp = buildLightnessRamp(H, { steps: 11, chroma: 0.4 });
      for (const stop of ramp) {
        expect(inGamut(stop, "srgb")).toBe(true);
      }
    }
  });

  it("gamut-maps every stop into P3 when asked", () => {
    const ramp = buildLightnessRamp(145, {
      steps: 11,
      chroma: 0.4,
      gamut: "p3",
    });
    for (const stop of ramp) {
      expect(inGamut(stop, "p3")).toBe(true);
    }
  });

  it("clamps steps to ≥ 2 (so the t = i/(steps-1) divisor never blows up)", () => {
    for (const steps of [1, 0, -5]) {
      const ramp = buildLightnessRamp(260, { steps });
      expect(ramp).toHaveLength(2);
      for (const stop of ramp) {
        expect(Number.isFinite(stop.L)).toBe(true);
        expect(Number.isFinite(stop.C)).toBe(true);
      }
    }
    // Fractional step counts floor down, then clamp.
    expect(buildLightnessRamp(260, { steps: 1.9 })).toHaveLength(2);
  });

  it("is deterministic — same input yields identical output", () => {
    const opts = { steps: 8, chroma: 0.2, minL: 0.1, maxL: 0.95 };
    expect(buildLightnessRamp(195, opts)).toEqual(
      buildLightnessRamp(195, opts),
    );
  });
});
