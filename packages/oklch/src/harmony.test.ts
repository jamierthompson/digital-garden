import { describe, expect, it } from "vitest";

import { buildHarmonyPalette, HARMONY_KINDS } from "./harmony";
import { parseColor } from "./convert";
import { inGamut } from "./gamut";
import { checkContrast } from "./contrast";

/** Angular distance on the hue circle (0–180). */
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe("buildHarmonyPalette (#102)", () => {
  const SEED_HUES = [5, 60, 145, 200, 262, 350]; // incl. both wrap edges

  it.each(SEED_HUES)("rotates the documented angles from seed hue %i", (H) => {
    // Chroma 0.04 at L 0.6 is inside sRGB at every hue, so the mapper is the identity
    // and the NOMINAL rotation survives to the output exactly.
    const palette = buildHarmonyPalette(`oklch(0.6 0.04 ${H})`);
    const seedH = palette.seed.H;
    const expectAngles = (kind: keyof typeof palette, deltas: number[]) => {
      const set = palette[kind] as { H: number }[];
      expect(set).toHaveLength(deltas.length);
      for (let i = 0; i < deltas.length; i++) {
        expect(
          hueDist(set[i].H, (((seedH + deltas[i]) % 360) + 360) % 360),
          `${String(kind)}[${i}] from hue ${H}`,
        ).toBeLessThan(1e-9);
      }
    };
    expectAngles("analogous", [-30, 30]);
    expectAngles("complementary", [180]);
    expectAngles("triadic", [-120, 120]);
    expectAngles("split-complementary", [150, 210]);
  });

  it("normalizes every derived hue into [0, 360) across the wrap", () => {
    for (const H of SEED_HUES) {
      const palette = buildHarmonyPalette(`oklch(0.6 0.12 ${H})`);
      for (const kind of HARMONY_KINDS) {
        for (const color of palette[kind]) {
          expect(color.H).toBeGreaterThanOrEqual(0);
          expect(color.H).toBeLessThan(360);
        }
      }
    }
  });

  it("holds the seed's lightness (± the mapper's clip nudge) and gamut-maps every color", () => {
    // A saturated seed whose rotations cross gamut-tight hue regions: the CSS4 mapper
    // trims chroma at ~constant L, but accepts a sub-JND clip at the boundary
    // (gamut.ts JND = 0.02 ΔEok) — so family coherence is bounded by the mapper's own
    // imperceptibility budget, not bit-equality.
    const palette = buildHarmonyPalette("oklch(0.65 0.25 30)");
    for (const kind of HARMONY_KINDS) {
      for (const color of palette[kind]) {
        expect(Math.abs(color.L - palette.seed.L)).toBeLessThan(0.02);
        expect(inGamut(color, "srgb")).toBe(true);
      }
    }
  });

  it("maps into P3 when asked", () => {
    const palette = buildHarmonyPalette("oklch(0.65 0.28 145)", {
      gamut: "p3",
    });
    for (const kind of HARMONY_KINDS) {
      for (const color of palette[kind]) {
        expect(inGamut(color, "p3")).toBe(true);
      }
    }
  });

  it("falls back defensively on unparseable input, never throws", () => {
    for (const bad of ["garbage", "", null, undefined, 42, {}]) {
      const palette = buildHarmonyPalette(bad);
      expect(palette.isFallback).toBe(true);
      expect(palette.complementary).toHaveLength(1);
    }
    const good = buildHarmonyPalette("#3b82f6");
    expect(good.isFallback).toBe(false);
  });

  it("is deterministic", () => {
    expect(buildHarmonyPalette("#e11d48")).toEqual(
      buildHarmonyPalette("#e11d48"),
    );
  });

  it("is decorative — but composes with checkContrast when a color must back text", () => {
    // The documented consumer pattern: harmony colors carry no contrast guarantee;
    // a consumer that puts text on one checks it explicitly (#100).
    const palette = buildHarmonyPalette("#3b82f6");
    const [comp] = palette.complementary;
    const label = parseColor("#ffffff")!;
    const check = checkContrast(label, comp, { wcag: 4.5, apca: 60 });
    expect(typeof check.passes).toBe("boolean"); // no guarantee either way — measured, not promised
    expect(check.wcag).toBeGreaterThan(1);
  });
});
