import { describe, expect, it } from "vitest";

import { gamutMap, inGamut } from "./gamut";
import type { Gamut, OkLCH } from "./types";

/** Brand-ish hues spanning the wheel, incl. the yellow/cyan stressers. */
const HUES = [29, 110, 145, 195, 260, 330];

describe("gamutMap", () => {
  it.each(HUES)("maps an over-saturated hue %i into sRGB gamut", (H) => {
    // C = 0.4 exceeds sRGB for every hue at mid lightness.
    const out = gamutMap({ L: 0.6, C: 0.4, H }, "srgb");
    expect(inGamut(out, "srgb")).toBe(true);
    expect(out.C).toBeLessThan(0.4);
    expect(out.L).toBeCloseTo(0.6, 2); // L is held; only chroma reduces
  });

  it.each(HUES)("maps an over-saturated hue %i into P3 gamut", (H) => {
    const out = gamutMap({ L: 0.6, C: 0.4, H }, "p3");
    expect(inGamut(out, "p3")).toBe(true);
  });

  it("P3 admits more chroma than sRGB for the same hue", () => {
    const srgb = gamutMap({ L: 0.6, C: 0.4, H: 145 }, "srgb");
    const p3 = gamutMap({ L: 0.6, C: 0.4, H: 145 }, "p3");
    expect(p3.C).toBeGreaterThanOrEqual(srgb.C);
  });

  it("leaves an already-in-gamut color unchanged", () => {
    const grey: OkLCH = { L: 0.5, C: 0, H: 0 };
    expect(gamutMap(grey, "srgb")).toEqual(grey);
  });

  it("clamps the lightness extremes to neutral", () => {
    expect(gamutMap({ L: 0, C: 0.2, H: 100 }, "srgb")).toMatchObject({
      L: 0,
      C: 0,
    });
    expect(gamutMap({ L: 1, C: 0.2, H: 100 }, "srgb")).toMatchObject({
      L: 1,
      C: 0,
    });
  });

  it("is deterministic", () => {
    const a = gamutMap({ L: 0.7, C: 0.35, H: 110 }, "srgb");
    const b = gamutMap({ L: 0.7, C: 0.35, H: 110 }, "srgb");
    expect(a).toEqual(b);
  });

  it("never throws and always returns an in-gamut color", () => {
    const gamuts: Gamut[] = ["srgb", "p3"];
    for (const gamut of gamuts) {
      for (let L = 0; L <= 1.0001; L += 0.1) {
        for (const H of HUES) {
          const out = gamutMap({ L, C: 0.5, H }, gamut);
          expect(inGamut(out, gamut)).toBe(true);
        }
      }
    }
  });
});
