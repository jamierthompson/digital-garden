import { describe, expect, it } from "vitest";

import {
  formatColor,
  formatHex,
  formatOklch,
  formatRgb,
  oklchToSrgb,
  parseColor,
  srgbToOklch,
} from "./convert";
import type { OkLCH, RGB } from "./types";

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

  it("returns null for unparseable input (caller uses the fallback)", () => {
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

describe("formatHex / formatRgb / formatColor", () => {
  it("round-trips an sRGB hex literal through OKLCH exactly", () => {
    const parsed = parseColor("#3b82f6")!;
    expect(formatHex(parsed)).toBe("#3b82f6");
    expect(formatRgb(parsed)).toBe("rgb(59 130 246)");
  });

  it("serializes the extremes without drift", () => {
    expect(formatHex(srgbToOklch({ r: 1, g: 1, b: 1 }))).toBe("#ffffff");
    expect(formatHex(srgbToOklch({ r: 0, g: 0, b: 0 }))).toBe("#000000");
    expect(formatRgb(srgbToOklch({ r: 1, g: 0, b: 0 }))).toBe("rgb(255 0 0)");
  });

  it("zero-pads low channels", () => {
    expect(formatHex(parseColor("#000a0b")!)).toBe("#000a0b");
  });

  it("clamps an out-of-sRGB color instead of overflowing", () => {
    // Full-chroma OKLCH green is far outside sRGB — channels must clamp to [0,255].
    const wild = { L: 0.65, C: 0.4, H: 145 };
    expect(formatHex(wild)).toMatch(/^#[0-9a-f]{6}$/);
    const rgb = formatRgb(wild).match(/\d+/g)!.map(Number);
    for (const ch of rgb) {
      expect(ch).toBeGreaterThanOrEqual(0);
      expect(ch).toBeLessThanOrEqual(255);
    }
  });

  it("formatColor routes to the matching serializer", () => {
    const c = parseColor("#3b82f6")!;
    expect(formatColor(c, "oklch")).toBe(formatOklch(c));
    expect(formatColor(c, "hex")).toBe("#3b82f6");
    expect(formatColor(c, "rgb")).toBe("rgb(59 130 246)");
  });
});

// The serializers are PUBLIC exports (`@garden/oklch`, routed through by the studio export
// #107) — so a consumer can call them on a hand-built OKLCH the engine's own token path never
// produces (which guards finiteness upstream). These pin the exported serializers' defended
// behavior on non-finite input and the documented sRGB round-trip losslessness (#99).
describe("serializers — non-finite input (defended per QA-99)", () => {
  const nan: OkLCH = { L: NaN, C: NaN, H: NaN };
  const inf: OkLCH = { L: Infinity, C: Infinity, H: Infinity };

  it("hex and rgb degrade IDENTICALLY to black on non-finite channels — never invalid CSS", () => {
    // formatHex once masked NaN as #000000 while formatRgb emitted the invalid literal
    // rgb(NaN NaN NaN) — divergent failure modes for the same bad input. Both now collapse
    // non-finite channels to 0 (srgb255), one documented degradation.
    expect(formatHex(nan)).toBe("#000000");
    expect(formatHex(inf)).toBe("#000000");
    expect(formatRgb(nan)).toBe("rgb(0 0 0)");
    expect(formatRgb(inf)).toBe("rgb(0 0 0)");
  });

  it("Infinity on only some channels still yields valid output", () => {
    expect(formatRgb({ L: 0.5, C: Infinity, H: 200 })).toMatch(
      /^rgb\(\d+ \d+ \d+\)$/,
    );
  });

  it("formatColor with an out-of-union format falls back to the native oklch literal", () => {
    // TypeScript blocks this at compile time; a JS caller casting past the union used to get
    // silent `undefined` — now the default arm returns the lossless literal.
    const c: OkLCH = { L: 0.5, C: 0.1, H: 200 };
    expect(formatColor(c, "hsl" as never)).toBe(formatColor(c, "oklch"));
  });
});

describe("serializers — sRGB round-trip losslessness (the documented guarantee)", () => {
  it("round-trips every #rgb shorthand color exactly through OKLCH → hex", () => {
    let mismatches = 0;
    for (let i = 0; i < 0x1000; i++) {
      const short = "#" + i.toString(16).padStart(3, "0");
      const long =
        "#" + short[1] + short[1] + short[2] + short[2] + short[3] + short[3];
      const c = parseColor(short);
      expect(c).not.toBeNull();
      if (formatHex(c!) !== long) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it("round-trips assorted 6-digit sRGB hexes exactly", () => {
    for (const hex of [
      "#000000",
      "#ffffff",
      "#123456",
      "#abcdef",
      "#7f7f7f",
      "#010203",
      "#fe00ba",
      "#00ff88",
    ]) {
      expect(formatHex(parseColor(hex)!)).toBe(hex);
    }
  });

  it("serializes a grey (C=0) stably regardless of the meaningless hue", () => {
    // Hue is undefined for greys; it must not leak into the sRGB rendering.
    expect(formatHex({ L: 0.5, C: 0, H: 0 })).toBe(
      formatHex({ L: 0.5, C: 0, H: 359.9 }),
    );
  });
});

describe("alpha serialization (#160 — scrim)", () => {
  const opaque: OkLCH = { L: 0.5, C: 0.1, H: 260 };
  const translucent: OkLCH = { L: 0.2, C: 0.02, H: 260, alpha: 0.6 };

  it("formatOklch appends `/ a` ONLY when translucent", () => {
    expect(formatOklch(opaque)).toBe("oklch(0.5 0.1 260)");
    expect(formatOklch(translucent)).toBe("oklch(0.2 0.02 260 / 0.6)");
    // alpha 1 / omitted → opaque, byte-identical to the no-alpha form.
    expect(formatOklch({ ...opaque, alpha: 1 })).toBe("oklch(0.5 0.1 260)");
  });

  it("formatHex appends an 8-digit alpha byte ONLY when translucent", () => {
    expect(formatHex(opaque)).toMatch(/^#[0-9a-f]{6}$/);
    const hex = formatHex(translucent);
    expect(hex).toMatch(/^#[0-9a-f]{8}$/);
    expect(hex.slice(-2)).toBe("99"); // round(0.6 * 255) = 153 = 0x99
  });

  it("formatRgb emits `/ a` ONLY when translucent", () => {
    expect(formatRgb(opaque)).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
    expect(formatRgb(translucent)).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.6\)$/);
  });

  it("clamps a stray out-of-range alpha and treats >=1 as opaque", () => {
    expect(formatOklch({ ...opaque, alpha: -0.3 })).toBe(
      "oklch(0.5 0.1 260 / 0)",
    );
    expect(formatOklch({ ...opaque, alpha: 1.5 })).toBe("oklch(0.5 0.1 260)");
  });
});
