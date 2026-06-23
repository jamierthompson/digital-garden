import { describe, expect, it } from "vitest";

import {
  apcaLc,
  contrastAPCA,
  contrastWCAG,
  solveForeground,
} from "./contrast";
import { parseColor } from "./convert";
import { inGamut } from "./gamut";
import type { OkLCH } from "./types";

const BLACK = parseColor("#000000")!;
const WHITE = parseColor("#ffffff")!;

describe("contrastWCAG", () => {
  it("returns 21:1 for black on white", () => {
    expect(contrastWCAG(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for a color on itself", () => {
    expect(contrastWCAG(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastWCAG(BLACK, WHITE)).toBeCloseTo(
      contrastWCAG(WHITE, BLACK),
      6,
    );
  });
});

describe("contrastAPCA (SA98G reference anchors)", () => {
  it("black text on white ≈ Lc 106", () => {
    // Reference: APCA 0.1.9 reports Lc 106.04 for #000 on #fff.
    expect(contrastAPCA(BLACK, WHITE)).toBeCloseTo(106.04, 0);
  });

  it("white text on black ≈ Lc -107.9 (reverse polarity)", () => {
    expect(contrastAPCA(WHITE, BLACK)).toBeCloseTo(-107.89, 0);
  });

  it("apcaLc returns the magnitude regardless of polarity", () => {
    expect(apcaLc(BLACK, WHITE)).toBeCloseTo(106.04, 0);
    expect(apcaLc(WHITE, BLACK)).toBeCloseTo(107.89, 0);
  });

  it("is ~0 for identical colors", () => {
    expect(apcaLc(WHITE, WHITE)).toBe(0);
  });
});

describe("solveForeground", () => {
  const HUES = [29, 110, 145, 195, 260, 330]; // incl. yellow (110) & cyan (195)
  const lightBg: OkLCH = { L: 0.985, C: 0.004, H: 260 };
  const darkBg: OkLCH = { L: 0.17, C: 0.01, H: 260 };

  it.each(HUES)("hits the body-text target on a light bg for hue %i", (H) => {
    const fg = solveForeground({
      bg: lightBg,
      hue: H,
      chroma: 0.15,
      target: { wcag: 4.5, apca: 75 },
      gamut: "srgb",
    });
    expect(contrastWCAG(fg, lightBg)).toBeGreaterThanOrEqual(4.5);
    expect(apcaLc(fg, lightBg)).toBeGreaterThanOrEqual(75);
    expect(inGamut(fg, "srgb")).toBe(true);
    expect(fg.L).toBeLessThan(lightBg.L); // darker text on a light surface
  });

  it.each(HUES)("hits the body-text target on a dark bg for hue %i", (H) => {
    const fg = solveForeground({
      bg: darkBg,
      hue: H,
      chroma: 0.15,
      target: { wcag: 4.5, apca: 75 },
      gamut: "srgb",
    });
    expect(contrastWCAG(fg, darkBg)).toBeGreaterThanOrEqual(4.5);
    expect(apcaLc(fg, darkBg)).toBeGreaterThanOrEqual(75);
    expect(fg.L).toBeGreaterThan(darkBg.L); // lighter text on a dark surface
  });

  it("backs off chroma when a vivid hue cannot meet the target at full chroma", () => {
    // Yellow links at high chroma can't clear 4.5:1 on white — the solver desaturates.
    const fg = solveForeground({
      bg: lightBg,
      hue: 110,
      chroma: 0.2,
      target: { wcag: 4.5, apca: 60 },
      gamut: "srgb",
    });
    expect(contrastWCAG(fg, lightBg)).toBeGreaterThanOrEqual(4.5);
    expect(fg.C).toBeLessThan(0.2);
  });

  it("is deterministic", () => {
    const opts = {
      bg: lightBg,
      hue: 195,
      chroma: 0.12,
      target: { wcag: 4.5, apca: 75 },
      gamut: "srgb" as const,
    };
    expect(solveForeground(opts)).toEqual(solveForeground(opts));
  });
});
