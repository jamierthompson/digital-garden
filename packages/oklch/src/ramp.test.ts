import { describe, expect, it } from "vitest";

import { inGamut } from "./gamut";
import { buildLightnessRamp, buildRamp } from "./ramp";
import { RAMP_LABELS } from "./types";

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

describe("buildRamp (the 50…950 role primitive)", () => {
  it("returns exactly the 11 labelled steps, in 50→950 order", () => {
    const ramp = buildRamp({ hue: 260, chroma: 0.12, gamut: "srgb" });
    expect(ramp.map((s) => s.label)).toEqual([...RAMP_LABELS]);
  });

  it("steps lightness monotonically DOWN — 50 is lightest, 950 darkest (Tailwind order)", () => {
    const ramp = buildRamp({ hue: 260, chroma: 0.12, gamut: "srgb" });
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].color.L).toBeLessThan(ramp[i - 1].color.L);
    }
    // The named ends bracket the scale: 50 near-white, 950 near-black.
    expect(ramp[0].color.L).toBeGreaterThan(0.95);
    expect(ramp[ramp.length - 1].color.L).toBeLessThan(0.2);
  });

  it("gamut-maps every step into the target gamut, even at high chroma", () => {
    for (const H of HUES) {
      const ramp = buildRamp({ hue: H, chroma: 0.4, gamut: "srgb" });
      for (const step of ramp) {
        expect(inGamut(step.color, "srgb")).toBe(true);
      }
    }
  });

  it("gamut-maps into P3 when asked", () => {
    const ramp = buildRamp({ hue: 145, chroma: 0.4, gamut: "p3" });
    for (const step of ramp) {
      expect(inGamut(step.color, "p3")).toBe(true);
    }
  });

  it("flags oog per step: a high nominal chroma is out-of-gamut at the extremes, in-gamut mid", () => {
    // At C 0.3 a hue's darkest/lightest steps overflow sRGB (flagged oog + chroma-reduced),
    // while a near-mid step can sit inside it. The flag is surfaced, not swallowed.
    const ramp = buildRamp({ hue: 29, chroma: 0.3, gamut: "srgb" });
    // Extremes are OOG at this chroma…
    expect(ramp[0].oog).toBe(true); // 50 (near-white can't hold C 0.3)
    expect(ramp[ramp.length - 1].oog).toBe(true); // 950 (near-black can't either)
    // …and where oog is true, the emitted color really was chroma-reduced to fit.
    for (const step of ramp) {
      if (step.oog) expect(step.color.C).toBeLessThan(0.3);
      expect(inGamut(step.color, "srgb")).toBe(true);
    }
  });

  it("never flags oog for a zero-chroma (pure-grey) ramp — grey is in gamut at every L", () => {
    const ramp = buildRamp({ hue: 200, chroma: 0, gamut: "srgb" });
    for (const step of ramp) {
      expect(step.oog).toBe(false);
      expect(step.color.C).toBe(0);
    }
  });

  it("clamps a negative nominal chroma to 0 rather than producing NaN", () => {
    const ramp = buildRamp({ hue: 200, chroma: -1, gamut: "srgb" });
    for (const step of ramp) {
      expect(step.color.C).toBe(0);
      expect(Number.isFinite(step.color.L)).toBe(true);
    }
  });

  it("is deterministic — same spec yields identical steps", () => {
    const spec = { hue: 195, chroma: 0.15, gamut: "srgb" as const };
    expect(buildRamp(spec)).toEqual(buildRamp(spec));
  });
});
