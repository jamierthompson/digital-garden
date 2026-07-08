import { describe, expect, it } from "vitest";

import {
  buildTypeScale,
  DEFAULT_CONFIG,
  fluidClampString,
  modularSize,
  sizeVarName,
  solveStep,
  typeScaleToDeclarations,
  ZOOM_CAP_RATIO,
} from "./index";
import type { ScaleConfig } from "./index";

// This suite runs under BOTH node and jsdom (vitest.config.ts `projects`) — the isomorphism
// half of the engine guarantee. The math must be bit-identical in both, so every assertion is
// exact (no environment-conditional expectations).

const px = (rem: number): number => rem * 16;

describe("modularSize — geometric scale", () => {
  it("is the base at exponent 0 (ratio⁰), whatever the ratio", () => {
    expect(modularSize(1, 1.25, 0)).toBe(1);
    expect(modularSize(1.125, 1.5, 0)).toBe(1.125);
  });

  it("climbs by the ratio going up and divides going down", () => {
    expect(modularSize(1, 1.2, 1)).toBeCloseTo(1.2, 10);
    expect(modularSize(1, 1.2, 2)).toBeCloseTo(1.44, 10);
    expect(modularSize(1, 1.2, -1)).toBeCloseTo(1 / 1.2, 10);
  });
});

describe("fluidClampString — Utopia interpolation", () => {
  it("emits a growing step as clamp(floor, intercept + slope·vw, ceil)", () => {
    // Body at the default endpoints: 16px→18px over 320→1280px. Worked by hand:
    // slope = (18−16)/(1280−320) = 0.0020833 px/px → 0.2083vw; intercept = 16 − slope·320 =
    // 15.3333px → 0.9583rem. Floor/ceil are the two rem sizes.
    expect(fluidClampString(1, 1.125, 320, 1280)).toBe(
      "clamp(1rem, 0.9583rem + 0.2083vw, 1.125rem)",
    );
  });

  it("orders a SHRINKING (sub-base) step into floor≤ceil with a negative vw term", () => {
    // A step that is larger on mobile than desktop: start (small vw) > end (large vw).
    const clamp = fluidClampString(0.7, 0.6, 320, 1280);
    expect(clamp.startsWith("clamp(0.6rem,")).toBe(true); // floor = the smaller (desktop) size
    expect(clamp.endsWith(", 0.7rem)")).toBe(true); // ceil = the larger (mobile) size
    expect(clamp).toContain(" - "); // negative slope → subtracted vw term, never "+ -"
    expect(clamp).not.toContain("+ -");
  });

  it("collapses to a constant rem when both ends are equal (no `x rem + 0vw`)", () => {
    expect(fluidClampString(1, 1, 320, 1280)).toBe("1rem");
  });

  it("never emits a negative-zero rem", () => {
    expect(fluidClampString(0, 0, 320, 1280)).toBe("0rem");
  });
});

describe("solveStep — the zoom cap (WCAG 1.4.4)", () => {
  it("leaves a step within the cap untouched and unflagged", () => {
    // 16→18px body: ceil/floor = 1.125 ≪ 2.4, so no cap.
    const step = solveStep(1, 1.125, 1.2, 1.333, 0, 320, 1280);
    expect(step.zoomCapped).toBe(false);
    expect(step.minRem).toBe(1);
    expect(step.maxRem).toBe(1.125);
  });

  it("pulls a HOT step's ceiling down to 2.4× the floor and flags it", () => {
    // A deliberately hot spread: floor = 1.2³ = 1.728, ceil = 2.0³ = 8 → 8 > 2.4·1.728.
    const step = solveStep(1, 1, 1.2, 2.0, 3, 320, 1280);
    expect(step.zoomCapped).toBe(true);
    expect(step.minRem).toBeCloseTo(1.728, 4);
    expect(step.maxRem).toBeCloseTo(ZOOM_CAP_RATIO * 1.728, 4);
    // The emitted clamp's ceiling slot equals the capped max, never the original 8rem.
    expect(step.clamp).toContain(`${step.maxRem}rem)`);
    expect(step.clamp).not.toContain(", 8rem)");
  });

  it("degrades to the floor constant when the viewport span is zero/reversed (never NaN)", () => {
    const step = solveStep(1, 1.125, 1.2, 1.333, 0, 1280, 1280);
    expect(step.clamp).toBe("1rem");
    expect(step.clamp).not.toContain("NaN");
  });
});

describe("buildTypeScale — the solved ramp", () => {
  it("emits `stepCount` steps and, for the default config, caps none", () => {
    const scale = buildTypeScale();
    expect(scale.meta.isFallback).toBe(false);
    expect(scale.steps).toHaveLength(DEFAULT_CONFIG.stepCount);
    expect(scale.meta.zoomCappedSteps).toEqual([]);
    for (const step of scale.steps) {
      expect(step.clamp).toBeTruthy();
    }
  });

  it("puts the base size at `baseIndex` (ratio⁰ = fluid 16→18px)", () => {
    const scale = buildTypeScale();
    const base = scale.steps[DEFAULT_CONFIG.baseIndex - 1]; // 1-based index → 0-based array
    expect(px(base.minRem)).toBe(16);
    expect(px(base.maxRem)).toBe(18);
  });

  it("is strictly monotonic in rem across the ramp (each step larger than the last)", () => {
    const scale = buildTypeScale();
    for (let i = 1; i < scale.steps.length; i += 1) {
      expect(scale.steps[i].maxRem).toBeGreaterThan(scale.steps[i - 1].maxRem);
    }
  });

  it("holds the zoom invariant maxRem ≤ 2.4·minRem for EVERY step, default and hot configs", () => {
    const hot: ScaleConfig = {
      ...DEFAULT_CONFIG,
      minRatio: 1.1,
      maxRatio: 1.9,
    };
    for (const scale of [buildTypeScale(), buildTypeScale(hot)]) {
      for (const step of scale.steps) {
        // +1e-4 tolerance for independent 4-dp rounding of the two bounds.
        expect(step.maxRem).toBeLessThanOrEqual(
          ZOOM_CAP_RATIO * step.minRem + 1e-4,
        );
      }
    }
    // The hot config must actually exercise the cap (else the invariant is vacuous).
    expect(buildTypeScale(hot).meta.zoomCappedSteps.length).toBeGreaterThan(0);
  });

  it("body never falls below 16px at the small end (the reading floor)", () => {
    const scale = buildTypeScale();
    expect(
      px(scale.steps[DEFAULT_CONFIG.baseIndex - 1].minRem),
    ).toBeGreaterThanOrEqual(16);
  });

  it("merges a partial config over the default without discarding the rest", () => {
    const scale = buildTypeScale({ minRatio: 1.5, stepCount: 7 });
    expect(scale.meta.isFallback).toBe(false);
    expect(scale.meta.config.minRatio).toBe(1.5);
    expect(scale.meta.config.maxRatio).toBe(DEFAULT_CONFIG.maxRatio);
    expect(scale.steps).toHaveLength(7);
  });

  it("is deterministic — identical config yields identical output", () => {
    expect(buildTypeScale({ minRatio: 1.414 })).toEqual(
      buildTypeScale({ minRatio: 1.414 }),
    );
  });

  describe("never throws — falls back to the default ramp on bad input", () => {
    const bad: Array<[string, Partial<ScaleConfig>]> = [
      ["NaN base", { baseMinRem: NaN }],
      ["negative base", { baseMaxRem: -2 }],
      ["zero ratio", { minRatio: 0 }],
      ["non-finite ratio", { maxRatio: Infinity }],
      ["reversed viewport", { minVw: 1280, maxVw: 320 }],
      ["equal viewport", { minVw: 640, maxVw: 640 }],
      ["non-integer stepCount", { stepCount: 5.5 }],
      ["zero stepCount", { stepCount: 0 }],
      ["baseIndex past the ramp", { stepCount: 5, baseIndex: 9 }],
      ["string smuggled as number", { minRatio: "1.5" as unknown as number }],
    ];

    it.each(bad)(
      "%s → isFallback, valid default ramp, no NaN",
      (_label, config) => {
        const scale = buildTypeScale(config);
        expect(scale.meta.isFallback).toBe(true);
        expect(scale.meta.config).toEqual(DEFAULT_CONFIG);
        expect(scale.steps).toHaveLength(DEFAULT_CONFIG.stepCount);
        for (const step of scale.steps) {
          expect(step.clamp).not.toContain("NaN");
        }
      },
    );

    it("returns a usable ramp for the empty/undefined config", () => {
      expect(buildTypeScale(undefined).meta.isFallback).toBe(false);
      expect(buildTypeScale({}).meta.isFallback).toBe(false);
    });
  });
});

describe("typeScaleToDeclarations — CSS emission", () => {
  it("emits one --type-size-<n> per step, in ramp order, values matching the steps", () => {
    const scale = buildTypeScale();
    const decls = typeScaleToDeclarations(scale);
    expect(decls.map(([prop]) => prop)).toEqual(
      scale.steps.map((_, i) => sizeVarName(i + 1)),
    );
    decls.forEach(([, value], i) => {
      expect(value).toBe(scale.steps[i].clamp);
      expect(value).not.toContain("NaN");
    });
  });
});
