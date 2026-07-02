import { describe, expect, it } from "vitest";

import { cardSwatches, type CardSwatchVar } from "./cardSwatches";

/**
 * Defensive-totality contract for `cardSwatches`.
 *
 * The featured-home grid brands EVERY featured card from its `brandColor` — including a
 * featured note/essay/now with no `brandColor` (null), or a hostile/garbage value. The engine
 * is the fallback owner, but this consumer promises to NEVER throw and to ALWAYS return four
 * valid `light-dark(oklch(...), oklch(...))` literals. The existing contrast suite only feeds
 * VALID colors; this pins the bad-input edge the author's suite skipped.
 */

const VARS: readonly CardSwatchVar[] = [
  "--surface",
  "--text",
  "--border",
  "--accent",
];

// A baked, scheme-aware literal: light-dark(<oklch light>, <oklch dark>).
const LIGHT_DARK = /^light-dark\(oklch\([^)]*\),\s*oklch\([^)]*\)\)$/;

const BAD_INPUTS: readonly [string, unknown][] = [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["whitespace", "   "],
  ["garbage string", "not-a-color"],
  ["a number", 42],
  ["a plain object", { r: 1 }],
  ["an array", ["oklch(0.7 0.1 200)"]],
  ["boolean true", true],
  ["NaN", Number.NaN],
  ["a broken oklch", "oklch(nonsense)"],
  ["an unclosed function", "oklch(0.7 0.1"],
];

describe("cardSwatches — total & defensive on bad brandColor", () => {
  for (const [label, input] of BAD_INPUTS) {
    it(`never throws and returns valid baked literals for ${label}`, () => {
      let swatches!: ReturnType<typeof cardSwatches>;
      expect(() => {
        swatches = cardSwatches(input);
      }).not.toThrow();
      for (const v of VARS) {
        expect(swatches[v]).toMatch(LIGHT_DARK);
      }
    });
  }

  it("returns the SAME fallback palette for every unparseable input (deterministic)", () => {
    const a = cardSwatches(null);
    const b = cardSwatches("not-a-color");
    const c = cardSwatches(undefined);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("a parseable color yields a DIFFERENT (non-fallback) palette", () => {
    const fallback = cardSwatches(null);
    const real = cardSwatches("oklch(0.7 0.2 30)");
    expect(real).not.toEqual(fallback);
    for (const v of VARS) {
      expect(real[v]).toMatch(LIGHT_DARK);
    }
  });
});
