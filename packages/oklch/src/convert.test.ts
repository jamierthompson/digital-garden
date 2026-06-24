import { describe, expect, it } from "vitest";

import { formatOklch, oklchToSrgb, parseColor, srgbToOklch } from "./convert";
import type { RGB } from "./types";

/** Max per-channel error tolerated on a full sRGB → OKLCH → sRGB round-trip. */
const ROUND_TRIP_EPS = 1e-4;

function roundTrip(rgb: RGB): RGB {
  return oklchToSrgb(srgbToOklch(rgb));
}

describe("sRGB ⇄ OKLCH conversions", () => {
  const samples: Array<[string, RGB]> = [
    ["black", { r: 0, g: 0, b: 0 }],
    ["white", { r: 1, g: 1, b: 1 }],
    ["mid grey", { r: 0.5, g: 0.5, b: 0.5 }],
    ["red", { r: 1, g: 0, b: 0 }],
    ["green", { r: 0, g: 1, b: 0 }],
    ["blue", { r: 0, g: 0, b: 1 }],
    ["yellow", { r: 1, g: 1, b: 0 }],
    ["cyan", { r: 0, g: 1, b: 1 }],
  ];

  it.each(samples)("round-trips %s within epsilon", (_name, rgb) => {
    const back = roundTrip(rgb);
    expect(back.r).toBeCloseTo(rgb.r, 4);
    expect(back.g).toBeCloseTo(rgb.g, 4);
    expect(back.b).toBeCloseTo(rgb.b, 4);
  });

  it("places white at L≈1 and black at L≈0 with ~0 chroma", () => {
    const white = srgbToOklch({ r: 1, g: 1, b: 1 });
    const black = srgbToOklch({ r: 0, g: 0, b: 0 });
    expect(white.L).toBeCloseTo(1, 3);
    expect(white.C).toBeLessThan(ROUND_TRIP_EPS);
    expect(black.L).toBeCloseTo(0, 3);
  });

  it("matches a known OKLCH reference for sRGB red", () => {
    // Björn Ottosson / CSS Color 4 reference: sRGB red ≈ oklch(0.6280 0.2577 29.23).
    const red = srgbToOklch({ r: 1, g: 0, b: 0 });
    expect(red.L).toBeCloseTo(0.6279, 2);
    expect(red.C).toBeCloseTo(0.2577, 2);
    expect(red.H).toBeCloseTo(29.23, 1);
  });
});

describe("parseColor", () => {
  it("parses #rrggbb hex", () => {
    const c = parseColor("#ff0000");
    expect(c).not.toBeNull();
    expect(c!.H).toBeCloseTo(29.23, 1);
  });

  it("parses shorthand #rgb hex", () => {
    const long = parseColor("#ff0000");
    const short = parseColor("#f00");
    expect(short!.L).toBeCloseTo(long!.L, 6);
    expect(short!.H).toBeCloseTo(long!.H, 6);
  });

  it("parses #rrggbbaa hex (alpha ignored)", () => {
    const opaque = parseColor("#00ff00");
    const alpha = parseColor("#00ff0080");
    expect(alpha!.H).toBeCloseTo(opaque!.H, 6);
  });

  it("parses rgb() and rgba() functions", () => {
    const fromHex = parseColor("#0000ff");
    const fromRgb = parseColor("rgb(0, 0, 255)");
    const fromRgba = parseColor("rgba(0, 0, 255, 0.5)");
    expect(fromRgb!.H).toBeCloseTo(fromHex!.H, 4);
    expect(fromRgba!.H).toBeCloseTo(fromHex!.H, 4);
  });

  it("parses oklch() with numeric and percentage L", () => {
    const num = parseColor("oklch(0.7 0.15 200)");
    const pct = parseColor("oklch(70% 0.15 200)");
    expect(num).toEqual({ L: 0.7, C: 0.15, H: 200 });
    expect(pct!.L).toBeCloseTo(0.7, 6);
  });

  it("returns null for unparseable input (caller uses the fallback) [D9]", () => {
    expect(parseColor("not a color")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor("   ")).toBeNull();
    expect(parseColor("#xyz")).toBeNull();
    expect(parseColor(null)).toBeNull();
    expect(parseColor(undefined)).toBeNull();
    expect(parseColor(12345)).toBeNull();
    expect(parseColor({})).toBeNull();
  });

  it("never throws on hostile input", () => {
    const inputs: unknown[] = [
      NaN,
      Infinity,
      [],
      { L: 1 },
      "oklch(",
      "#",
      "rgb()",
    ];
    for (const input of inputs) {
      expect(() => parseColor(input)).not.toThrow();
    }
  });
});

describe("formatOklch", () => {
  it("emits a compact literal with trimmed decimals", () => {
    expect(formatOklch({ L: 0.62, C: 0.2, H: 29.2 })).toBe(
      "oklch(0.62 0.2 29.2)",
    );
  });

  it("rounds to the documented precision", () => {
    expect(formatOklch({ L: 0.123456, C: 0.234567, H: 123.456 })).toBe(
      "oklch(0.1235 0.2346 123.46)",
    );
  });
});
