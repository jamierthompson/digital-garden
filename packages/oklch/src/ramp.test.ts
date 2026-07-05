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

  it("degrades a non-finite steps count to the default instead of hanging", () => {
    // Infinity would run the stop loop forever; NaN emitted an empty ramp — both
    // degrade to the documented default (11), the never-hangs posture (#160 QA).
    expect(buildLightnessRamp(260, { steps: Infinity })).toHaveLength(11);
    expect(buildLightnessRamp(260, { steps: NaN })).toHaveLength(11);
  });

  it("terminates on a non-finite chroma, degrading to the achromatic axis (#160 QA)", () => {
    // buildRamp/buildLightnessRamp forward chroma into gamutMap, whose choke-point guard
    // lands Infinity on the same achromatic axis as NaN.
    for (const chroma of [Infinity, NaN]) {
      for (const stop of buildLightnessRamp(260, { steps: 3, chroma })) {
        expect(stop.C).toBe(0);
      }
      for (const step of buildRamp({ hue: 260, chroma, gamut: "srgb" })) {
        expect(step.color.C).toBe(0);
      }
    }
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

describe("seed anchor (#108)", () => {
  // Low chroma keeps every step in-gamut, so the mapped color's L IS the nominal L and
  // exactness can be asserted at full precision. Gamut-mapped exactness is a separate
  // case below — mapping happens AFTER anchoring, as the engine's order-of-ops requires.
  const SPEC = { hue: 260, chroma: 0.01, gamut: "srgb" as const };

  const anchorCases = RAMP_LABELS.flatMap((label) =>
    [0.25, 0.45, 0.55, 0.72, 0.88].map((L) => [label, L] as const),
  );

  it.each(anchorCases)(
    "pins step %s to L=%d exactly and keeps the other endpoints",
    (label, L) => {
      const ramp = buildRamp({ ...SPEC, anchor: { label, L } });
      const anchored = ramp.find((s) => s.label === label)!;
      expect(anchored.color.L).toBeCloseTo(L, 9);
      // Non-anchored endpoints preserved — surfaces bound to the extremes are unaffected.
      // (Anchoring an endpoint itself legitimately moves it: the pin wins.)
      const plain = buildRamp(SPEC);
      if (label !== "50")
        expect(ramp[0].color.L).toBeCloseTo(plain[0].color.L, 9);
      if (label !== "950")
        expect(ramp[10].color.L).toBeCloseTo(plain[10].color.L, 9);
    },
  );

  it("gamut-maps AFTER anchoring — a high-chroma anchored step pins the NOMINAL L", () => {
    // At chroma 0.12 / hue 260 the dark steps are out of sRGB; the mapped paint may move
    // L a hair (CSS4 mapping), but the oog flag reports the reduction and the pin is on
    // the nominal scale. Tolerance reflects the mapping, not the anchor.
    const ramp = buildRamp({
      hue: 260,
      chroma: 0.12,
      gamut: "srgb",
      anchor: { label: "500", L: 0.25 },
    });
    const anchored = ramp.find((s) => s.label === "500")!;
    expect(anchored.color.L).toBeCloseTo(0.25, 2);
  });

  it.each(anchorCases)(
    "stays strictly monotonic lightest→darkest around anchor %s at L=%d",
    (label, L) => {
      const ramp = buildRamp({ ...SPEC, anchor: { label, L } });
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i].color.L).toBeLessThan(ramp[i - 1].color.L);
      }
    },
  );

  it("clamps an out-of-scale anchor L instead of folding the ramp", () => {
    for (const L of [0, 0.05, 0.99, 1]) {
      const ramp = buildRamp({ ...SPEC, anchor: { label: "500", L } });
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i].color.L).toBeLessThan(ramp[i - 1].color.L);
      }
    }
  });

  it("without an anchor the shared scale is unchanged", () => {
    expect(buildRamp(SPEC)).toEqual(buildRamp({ ...SPEC }));
  });

  it("anchoring at an endpoint label keeps a usable ramp (span guard)", () => {
    for (const label of ["50", "950"] as const) {
      const ramp = buildRamp({ ...SPEC, anchor: { label, L: 0.5 } });
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i].color.L).toBeLessThan(ramp[i - 1].color.L);
      }
    }
  });
});

describe("generative rules (#101)", () => {
  const BASE = { hue: 260, chroma: 0.12, gamut: "srgb" as const };

  it("all-default rules reproduce the un-ruled ramp exactly", () => {
    expect(
      buildRamp({
        ...BASE,
        rules: {
          distribution: "tailwind",
          chromaPolicy: "flat",
          huePolicy: "constant",
        },
      }),
    ).toEqual(buildRamp(BASE));
  });

  // Chroma 0 keeps every step in gamut, isolating the distribution math from mapping.
  const DISTS = ["linear", "eased", "punchy", "soft"] as const;

  it.each(DISTS)(
    "distribution %s pins the shoulders, reshapes the interior, stays strictly monotonic",
    (distribution) => {
      const ramp = buildRamp({ ...BASE, chroma: 0, rules: { distribution } });
      const plain = buildRamp({ ...BASE, chroma: 0 });
      // The surface-bearing steps + the far text extreme never move — this is what keeps the
      // contrast guarantees intact under every policy (see scaleOf). buildRamp defaults to the
      // LIGHT scale, whose five surfaces sit at 50…400 (indexes 0–4) and text extreme at 950 (10).
      for (const i of [0, 1, 2, 3, 4, 10]) {
        expect(ramp[i].color.L, `shoulder ${ramp[i].label}`).toBeCloseTo(
          plain[i].color.L,
          9,
        );
      }
      // …the text-zone interior (light: 500…900, indexes 5–9) genuinely differs from default…
      expect(ramp.slice(5, 10).map((s) => s.color.L)).not.toEqual(
        plain.slice(5, 10).map((s) => s.color.L),
      );
      // …and the whole scale stays strictly monotonic across the shoulder boundaries.
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i].color.L).toBeLessThan(ramp[i - 1].color.L);
      }
    },
  );

  it("taper pulls chroma from both extremes; hold keeps chroma into the darks", () => {
    const taper = buildRamp({ ...BASE, rules: { chromaPolicy: "taper" } });
    const hold = buildRamp({ ...BASE, rules: { chromaPolicy: "hold" } });
    const flat = buildRamp(BASE);
    // Extremes: taper's nominal chroma → 0 (sin(0) = sin(π) = 0).
    expect(taper[0].color.C).toBeCloseTo(0, 6);
    expect(taper[10].color.C).toBeCloseTo(0, 6);
    // Near-dark steps: hold keeps more chroma than taper (flatter bell).
    const at = (r: typeof taper, label: string) =>
      r.find((s) => s.label === label)!.color.C;
    expect(at(hold, "900")).toBeGreaterThan(at(taper, "900"));
    // Flat is the identity — nominal chroma everywhere the gamut allows.
    expect(at(flat, "500")).toBeGreaterThanOrEqual(at(taper, "500"));
  });

  it("warm-shadows drifts dark steps warmer; cool-highlights mirrors it", () => {
    // Chroma 0: every step is in gamut, so the mapper is the identity and the NOMINAL
    // hue survives to the output (at low chroma near the gamut edge, clipping would
    // legitimately rotate an ill-conditioned hue — that's mapping behavior, not the
    // policy's).
    const warm = buildRamp({
      ...BASE,
      chroma: 0,
      rules: { huePolicy: "warm-shadows" },
    });
    const cool = buildRamp({
      ...BASE,
      chroma: 0,
      rules: { huePolicy: "cool-highlights" },
    });
    // ±9° at the ends, 0 at the middle step.
    expect(warm[10].color.H).toBeCloseTo(269, 6);
    expect(warm[0].color.H).toBeCloseTo(251, 6);
    expect(warm[5].color.H).toBeCloseTo(260, 6);
    expect(cool[10].color.H).toBeCloseTo(251, 6);
    expect(cool[0].color.H).toBeCloseTo(269, 6);
  });

  it("hue drift wraps at the 0/360 seam instead of leaving the circle", () => {
    const ramp = buildRamp({
      hue: 355,
      chroma: 0,
      gamut: "srgb",
      rules: { huePolicy: "warm-shadows" },
    });
    expect(ramp[10].color.H).toBeCloseTo(4, 6); // 355 + 9 → 4
    expect(ramp[10].color.H).toBeGreaterThanOrEqual(0);
    expect(ramp[10].color.H).toBeLessThan(360);
  });

  it("the seed anchor composes with a named distribution", () => {
    const ramp = buildRamp({
      ...BASE,
      chroma: 0.01,
      rules: { distribution: "eased" },
      anchor: { label: "500", L: 0.61 },
    });
    expect(ramp.find((s) => s.label === "500")!.color.L).toBeCloseTo(0.61, 9);
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].color.L).toBeLessThan(ramp[i - 1].color.L);
    }
  });
});

// QA #108 — adversarial hardening of the anchor math (adopted from QA-108's review; the
// lead re-based the exactness cases on chroma-0 ramps where the gamut map is the identity,
// and re-pinned the non-finite case to the defensive behavior the finding motivated).
describe("seed anchor (#108) — QA edge hardening", () => {
  const HARD = { hue: 260, chroma: 0, gamut: "srgb" as const };
  // Every documented nominal step L, so an anchor can land exactly on a neighbor's L.
  const NOMINALS = [
    0.985, 0.967, 0.922, 0.87, 0.708, 0.556, 0.439, 0.371, 0.269, 0.205, 0.145,
  ];
  const DENSE_LS: number[] = [];
  for (let L = -0.3; L <= 1.3; L += 0.01) DENSE_LS.push(Number(L.toFixed(3)));
  const EDGES = [0.145, 0.15, 0.1501, 0.98, 0.9799, 0.155, 0.975];

  // Explicit budget: an exhaustive sweep dilates past the default 5s per-test budget under
  // CPU contention (parallel QA agents / builds) — same rationale as palette.test.ts's
  // SWEEP_TIMEOUT; the real speed-up is #41.
  it("stays STRICTLY monotonic for every (label × L) across a dense grid incl. out-of-scale + duplicate-neighbor L", () => {
    for (const label of RAMP_LABELS) {
      for (const L of [...DENSE_LS, ...NOMINALS, ...EDGES]) {
        const ramp = buildRamp({ ...HARD, anchor: { label, L } });
        for (let i = 1; i < ramp.length; i++) {
          expect(ramp[i].color.L, `label=${label} L=${L} i=${i}`).toBeLessThan(
            ramp[i - 1].color.L,
          );
        }
      }
    }
  }, 30_000);

  it("clamps the anchored step to the scale's open interval — an out-of-scale seed L does NOT land exactly", () => {
    // Documents the true contract: the pin is EXACT only for L inside (~0.15, ~0.98);
    // beyond it the step is clamped (EDGE = 0.005 off each end), NOT the seed's L. Callers
    // relying on "the step's L IS the seed's" must know an extreme seed is clamped.
    const near1 = buildRamp({ ...HARD, anchor: { label: "500", L: 1 } }).find(
      (s) => s.label === "500",
    )!;
    const near0 = buildRamp({ ...HARD, anchor: { label: "500", L: 0 } }).find(
      (s) => s.label === "500",
    )!;
    expect(near1.color.L).toBeCloseTo(0.98, 9); // lightEnd - EDGE, not 1
    expect(near0.color.L).toBeCloseTo(0.15, 9); // darkEnd + EDGE, not 0
  });

  it("treats a non-finite anchor L as no anchor — never NaN, never a throw", () => {
    // QA-108 found NaN propagated into every step's lightness; the defensive posture
    // (never-throws, never-garbage) now ignores the anchor instead.
    const plain = buildRamp(HARD);
    for (const L of [NaN, Infinity, -Infinity]) {
      const ramp = buildRamp({ ...HARD, anchor: { label: "500", L } });
      expect(ramp).toEqual(plain);
      for (const step of ramp) {
        expect(Number.isFinite(step.color.L)).toBe(true);
      }
    }
  });
});
