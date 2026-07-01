import { describe, expect, it } from "vitest";

import { cardSwatches } from "./cardSwatches";

/** A baked `light-dark(oklch(…), oklch(…))` literal — no runtime color math. */
const LIGHT_DARK = /^light-dark\(oklch\([^)]+\), oklch\([^)]+\)\)$/;

/** The generic semantic tokens a card re-binds — the #57 no-prefix contract. */
const KEYS = ["--surface", "--text", "--border", "--accent"] as const;

describe("cardSwatches — valid brandColor", () => {
  const style = cardSwatches("#3b82f6");

  it("emits exactly the four generic semantic-token overrides", () => {
    expect(Object.keys(style).sort()).toEqual([...KEYS].sort());
  });

  it("uses only generic semantic names — no project-prefixed token leaks (#57)", () => {
    // Every key is a bare semantic role name; none is namespaced (`--c-*`, `--brand-*`, `--<proj>-*`).
    for (const key of Object.keys(style)) {
      expect(key).toMatch(/^--(?:surface|text|border|accent)$/);
    }
  });

  it("bakes every token as a light-dark() of oklch() literals", () => {
    for (const key of KEYS) {
      expect(style[key]).toMatch(LIGHT_DARK);
    }
  });

  it("returns plain inline-style data — no <style>, selector, or class", () => {
    for (const value of Object.values(style)) {
      expect(value).not.toContain("<style");
      expect(value).not.toContain("@layer");
      expect(value).not.toContain("{");
      expect(value).not.toContain("}");
      expect(value).not.toContain("[data-");
    }
  });

  it("tracks the brand color — a different brand yields a different palette", () => {
    const other = cardSwatches("#ef4444");
    // At least the accent must differ; in practice surface/text/border shift too.
    expect(style["--accent"]).not.toBe(other["--accent"]);
  });

  it("surface and text are distinct — the solved contrast pair, not one flat color", () => {
    expect(style["--surface"]).not.toBe(style["--text"]);
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

  it.each(hostile)("returns a full valid palette for %s", (_label, input) => {
    const style = cardSwatches(input);
    for (const key of KEYS) {
      expect(style[key]).toMatch(LIGHT_DARK);
    }
  });

  it("a hostile string cannot inject markup into any value", () => {
    const style = cardSwatches('#fff"}</style><script>alert(1)</script>');
    for (const value of Object.values(style)) {
      expect(value).toMatch(LIGHT_DARK);
      expect(value).not.toContain("<");
      expect(value).not.toContain("script");
    }
  });

  it("falls back deterministically — same bad input yields the same style", () => {
    expect(cardSwatches(null)).toEqual(cardSwatches(undefined));
  });
});
