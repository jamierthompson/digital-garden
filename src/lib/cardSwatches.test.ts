import { describe, expect, it } from "vitest";

import { cardSwatches } from "./cardSwatches";

/** A baked `light-dark(oklch(…), oklch(…))` literal — no runtime color math. */
const LIGHT_DARK = /^light-dark\(oklch\([^)]+\), oklch\([^)]+\)\)$/;

describe("cardSwatches — valid brandColor", () => {
  const style = cardSwatches("#3b82f6");

  it("emits exactly a `borderTopColor` — a real CSS property, no custom-property token", () => {
    expect(Object.keys(style)).toEqual(["borderTopColor"]);
    // No project-prefixed `--*` token leaks out (the #57 no-prefix contract).
    expect(Object.keys(style).some((k) => k.startsWith("--"))).toBe(false);
  });

  it("bakes the accent as a light-dark() of oklch() literals", () => {
    expect(style.borderTopColor).toMatch(LIGHT_DARK);
  });

  it("returns plain inline-style data — no <style>, selector, or class", () => {
    const value = style.borderTopColor;
    expect(value).not.toContain("<style");
    expect(value).not.toContain("@layer");
    expect(value).not.toContain("{");
    expect(value).not.toContain("}");
    expect(value).not.toContain("[data-");
  });

  it("tracks the brand color — a different brand yields a different accent", () => {
    expect(cardSwatches("#3b82f6").borderTopColor).not.toBe(
      cardSwatches("#ef4444").borderTopColor,
    );
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
    "returns a valid decorative accent for %s",
    (_label, input) => {
      expect(cardSwatches(input).borderTopColor).toMatch(LIGHT_DARK);
    },
  );

  it("a hostile string cannot inject markup into the value", () => {
    const value = cardSwatches(
      '#fff"}</style><script>alert(1)</script>',
    ).borderTopColor;
    expect(value).toMatch(LIGHT_DARK);
    expect(value).not.toContain("<");
    expect(value).not.toContain("script");
  });

  it("falls back deterministically — same bad input yields the same style", () => {
    expect(cardSwatches(null)).toEqual(cardSwatches(undefined));
  });
});
