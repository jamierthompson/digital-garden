import { describe, expect, it } from "vitest";

import { cardSwatches, type CardSwatchVar } from "./cardSwatches";

/** The full `--c-*` contract the helper promises. Keep in sync with STOPS. */
const KEYS: CardSwatchVar[] = [
  "--c-surface",
  "--c-border",
  "--c-text",
  "--c-accent",
];

/** A baked `light-dark(oklch(…), oklch(…))` literal — no runtime color math. */
const LIGHT_DARK = /^light-dark\(oklch\([^)]+\), oklch\([^)]+\)\)$/;

describe("cardSwatches — valid brandColor", () => {
  const swatches = cardSwatches("#3b82f6");

  it("emits exactly the curated --c-* stops and nothing else", () => {
    expect(Object.keys(swatches).sort()).toEqual([...KEYS].sort());
  });

  it("bakes every stop as a light-dark() of oklch() literals", () => {
    for (const key of KEYS) {
      expect(swatches[key]).toMatch(LIGHT_DARK);
    }
  });

  it("returns plain inline-style data — no <style>, selector, or class", () => {
    for (const key of KEYS) {
      const value = swatches[key];
      expect(value).not.toContain("<style");
      expect(value).not.toContain("@layer");
      expect(value).not.toContain("{");
      expect(value).not.toContain("}");
      expect(value).not.toContain("[data-");
    }
  });

  it("derives distinct colors per stop (not a single flat value)", () => {
    const values = new Set(KEYS.map((k) => swatches[k]));
    expect(values.size).toBeGreaterThan(1);
  });

  it("accepts the engine gamut option without throwing", () => {
    expect(() => cardSwatches("#3b82f6", { gamut: "p3" })).not.toThrow();
  });
});

describe("cardSwatches — defensive & total", () => {
  // Bad / missing / hostile inputs all flow through the engine's fallback palette.
  const hostile: [string, unknown][] = [
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["boolean", true],
    ["empty string", ""],
    ["garbage string", "not-a-color"],
    ["object", { brandColor: "#fff" }],
    ["array", ["#fff"]],
    ["injection-y string", '#fff"}</style><script>alert(1)</script>'],
    ["css-breakout string", "red; } body { display: none"],
  ];

  it.each(hostile)("never throws on %s", (_label, input) => {
    expect(() => cardSwatches(input)).not.toThrow();
  });

  it.each(hostile)(
    "returns a valid full swatch object for %s",
    (_label, input) => {
      const swatches = cardSwatches(input);
      expect(Object.keys(swatches).sort()).toEqual([...KEYS].sort());
      for (const key of KEYS) {
        expect(swatches[key]).toMatch(LIGHT_DARK);
      }
    },
  );

  it("a hostile string cannot inject markup into any value", () => {
    const swatches = cardSwatches('#fff"}</style><script>alert(1)</script>');
    for (const key of KEYS) {
      expect(swatches[key]).toMatch(LIGHT_DARK);
      expect(swatches[key]).not.toContain("<");
      expect(swatches[key]).not.toContain("script");
    }
  });

  it("falls back deterministically — same bad input yields the same swatches", () => {
    expect(cardSwatches(null)).toEqual(cardSwatches(undefined));
  });
});
