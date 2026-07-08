import { describe, expect, it } from "vitest";

import {
  buildTypeScale,
  DEFAULT_CONFIG,
  fluidClampString,
  ZOOM_CAP_RATIO,
} from "./index";
import type { ScaleConfig } from "./index";

// Adversarial QA suite — edge/error/boundary cases the author's suite skipped. Pure math only
// (no fs, no DOM): it runs identically under BOTH vitest projects (node + jsdom), like the rest
// of the engine glob. Fuzzing is deterministic (fixed-seed LCG) so a failure reproduces exactly.

/** Deterministic LCG — identical sequence in every env/run, so failures are reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

const VALID_CONSTANT = /^\d+(\.\d+)?rem$/;
const VALID_CLAMP =
  /^clamp\(\d+(\.\d+)?rem, \d+(\.\d+)?rem [+-] \d+(\.\d+)?vw, \d+(\.\d+)?rem\)$/;

const isValidCssSize = (clamp: string): boolean =>
  VALID_CONSTANT.test(clamp) || VALID_CLAMP.test(clamp);

describe("fluidClampString — independent re-derivation (Utopia)", () => {
  it("matches a hand-derived SUB-BASE clamp exactly (negative slope, ordered bounds)", () => {
    // 0.7rem at 320px → 0.6rem at 1280px. By hand:
    // slope = (9.6px − 11.2px) / (1280 − 320) = −0.0016667 px/px → vw coeff −0.1667;
    // intercept = 11.2 − (−0.0016667 × 320) = 11.7333px → 0.7333rem.
    expect(fluidClampString(0.7, 0.6, 320, 1280)).toBe(
      "clamp(0.6rem, 0.7333rem - 0.1667vw, 0.7rem)",
    );
  });
});

describe("the zoom cap on EMITTED values (the engine's load-bearing invariant)", () => {
  it("pins the 4-dp rounding leak: a valid config whose emitted maxRem exceeds 2.4 × minRem — beyond even the +1e-4 tolerance scale.test.ts grants itself", () => {
    // The cap is applied at FULL precision (`cappedCeil = 2.4 × floor`), then the floor and the
    // capped ceiling are rounded to 4 dp INDEPENDENTLY (scale.ts `round`): the floor can round
    // down while the ceiling rounds up, so the emitted pair leaks past the cap. Found by a
    // deterministic sweep; excess here = +1.6e-4 (2.4 × 2.3541 = 5.64984 < the emitted 5.65).
    const scale = buildTypeScale({
      baseMinRem: 2.3541488647460938,
      baseMaxRem: 10.265172621162492,
      stepCount: 1,
      baseIndex: 1,
    });
    expect(scale.meta.isFallback).toBe(false);
    const step = scale.steps[0];
    expect(step.zoomCapped).toBe(true);
    expect(step.maxRem).toBeLessThanOrEqual(ZOOM_CAP_RATIO * step.minRem);
  });

  it("property: emitted maxRem ≤ 2.4 × emitted minRem for EVERY step of every usable config (dense deterministic sweep)", () => {
    // The invariant on the numbers a consumer actually reads — the 4-dp values in the emitted
    // clamp — not on the pre-rounding internals. scale.test.ts asserts this with a +1e-4
    // tolerance "for independent 4-dp rounding"; this sweep shows the tolerance is not a fix
    // (worst-case leak is 5e-5 + 2.4 × 5e-5 = 1.7e-4 > 1e-4): round the cap coherently instead.
    const rand = makeRandom(0xc0ffee);
    const violations: string[] = [];
    for (let i = 0; i < 20000; i += 1) {
      const baseMinRem = 0.5 + rand() * 2.5;
      const baseMaxRem = baseMinRem * (1 + rand() * 9); // spreads hot enough to bite the cap
      const scale = buildTypeScale({ baseMinRem, baseMaxRem });
      for (const step of scale.steps) {
        // Tolerance for FLOAT noise only: `minRem`/`maxRem` are 4-dp DECIMALS, not exactly
        // representable in binary, so `2.4 × minRem` can land ~1 ULP (≈4e-16) below a `maxRem`
        // that is mathematically ≤ the cap. `1e-9` swallows that ULP jitter while still catching
        // any REAL leak by a mile — the pre-fix rounding leak was ~1.7e-4, five+ orders larger.
        const FLOAT_EPSILON = 1e-9;
        if (step.maxRem > ZOOM_CAP_RATIO * step.minRem + FLOAT_EPSILON) {
          violations.push(
            `baseMinRem=${baseMinRem} baseMaxRem=${baseMaxRem} → min=${step.minRem} max=${step.maxRem} (excess ${step.maxRem - ZOOM_CAP_RATIO * step.minRem})`,
          );
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
    expect(violations).toHaveLength(0);
  });
});

describe("emitted-value hygiene at numeric extremes (validation checks fields, not computed sizes)", () => {
  it("never emits a non-finite size: an overflowing-but-field-valid config must fall back (or stay finite), not bake `Infinityrem` into CSS", () => {
    // Every FIELD is finite and positive, so `isUsable` passes — but 1e308 × 10⁸ overflows to
    // Infinity at step 9, and both viewport ends being Infinity skips the cap entirely:
    // today this emits `--type-size-9: Infinityrem` with `isFallback: false`. README line 37:
    // "Any input — including author-time studio values — returns a valid scale."
    const scale = buildTypeScale({
      baseMinRem: 1e308,
      baseMaxRem: 1e308,
      minRatio: 10,
      maxRatio: 10,
      stepCount: 9,
      baseIndex: 1,
    });
    for (const step of scale.steps) {
      expect(Number.isFinite(step.minRem)).toBe(true);
      expect(Number.isFinite(step.maxRem)).toBe(true);
      expect(isValidCssSize(step.clamp)).toBe(true);
    }
  });

  it("never emits a ZERO size: a floor that underflows to 0 must not crush the step to `0rem` (font-size: 0 = invisible text)", () => {
    // 1e-320 × 1.2⁻⁸ underflows to 0 at step 1; the cap then pulls the ceiling down to
    // 2.4 × 0 = 0 and the whole step collapses to `0rem` — emitted, unflagged as fallback.
    const scale = buildTypeScale({
      baseMinRem: 1e-320,
      baseMaxRem: 1,
      stepCount: 9,
      baseIndex: 9,
    });
    for (const step of scale.steps) {
      expect(step.minRem).toBeGreaterThan(0);
      expect(step.maxRem).toBeGreaterThan(0);
    }
  });

  it("bounds stepCount: an absurd step count must fall back, not allocate the whole ramp", () => {
    // `isPositiveInt` has NO upper bound: stepCount 1e6 solves a million steps (~0.5s here);
    // 1e9 allocates gigabytes and effectively hangs the caller — "never throws" must not mean
    // "always computes". A studio-facing engine needs a sanity ceiling on the ramp length.
    const scale = buildTypeScale({ stepCount: 1_000_000 });
    expect(scale.meta.isFallback).toBe(true);
    expect(scale.steps).toHaveLength(DEFAULT_CONFIG.stepCount);
  });
});

describe("never-throws fuzz — garbage in every field, deterministic", () => {
  // Magnitude extremes (overflow/underflow/giant stepCount) are pinned individually above, so
  // each defect fails exactly one test; this pool covers the TYPE-level garbage (NaN, ±Infinity,
  // negatives, zero, non-integers, strings/null/objects smuggled through `as`) plus sane values,
  // cross-combined at random. Contract: never throw, and any non-fallback result emits valid CSS.
  const GARBAGE: unknown[] = [
    NaN,
    Infinity,
    -Infinity,
    -1,
    0,
    0.5,
    1.5,
    "1.5",
    null,
    undefined,
    {},
    [],
    true,
  ];
  const FIELDS: Array<keyof ScaleConfig> = [
    "baseMinRem",
    "baseMaxRem",
    "minRatio",
    "maxRatio",
    "minVw",
    "maxVw",
    "stepCount",
    "baseIndex",
  ];

  it("returns a structurally valid ramp for 2000 random garbage configs — no throw, no NaN, no invalid clamp()", () => {
    const rand = makeRandom(0xdead);
    for (let i = 0; i < 2000; i += 1) {
      const config: Record<string, unknown> = {};
      for (const field of FIELDS) {
        if (rand() < 0.6) {
          config[field] = GARBAGE[Math.floor(rand() * GARBAGE.length)];
        }
      }
      const scale = buildTypeScale(config as Partial<ScaleConfig>);
      expect(scale.steps.length).toBeGreaterThan(0);
      for (const step of scale.steps) {
        expect(step.clamp).not.toContain("NaN");
        expect(isValidCssSize(step.clamp)).toBe(true);
        expect(Number.isFinite(step.minRem)).toBe(true);
        expect(step.minRem).toBeLessThanOrEqual(step.maxRem);
      }
      if (scale.meta.isFallback) {
        expect(scale.meta.config).toEqual(DEFAULT_CONFIG);
        expect(scale.steps).toHaveLength(DEFAULT_CONFIG.stepCount);
      }
    }
  });

  it("is deterministic on a hostile config — two identical calls, deep-equal results", () => {
    const hostile: Partial<ScaleConfig> = {
      baseMinRem: 0.9999999999,
      baseMaxRem: 2.0000000001,
      minRatio: 1.6180339887,
      maxRatio: 1.6180339887,
      stepCount: 12,
      baseIndex: 12,
    };
    expect(buildTypeScale(hostile)).toEqual(buildTypeScale(hostile));
  });
});
