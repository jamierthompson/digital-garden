import { describe, expect, it } from "vitest";

import { contrastWCAG, parseColor } from "@garden/oklch";

import { cardSwatches } from "./cardSwatches";

/**
 * Engine contrast STRESS-TEST, via the featured-home card consumer.
 *
 * The featured-home grid exists to exercise the engine: a card's SURFACE and TEXT are both
 * engine-derived from its `brandColor`, so the ratio between them IS the solver's output.
 * This suite feeds `cardSwatches` a battery of edge-case brand colors — the hard paths the
 * solver must survive (too-light, yellow/cyan where a uniform ΔL fails, high-chroma /
 * wide-gamut, near-black) — parses the BAKED colors back out of each card's `light-dark()`
 * literals, and asserts:
 *   • text on surface clears WCAG 2.2 AA body contrast (≥ 4.5:1), and
 *   • the border + accent clear the non-text UI floor (≥ 3:1) on that same surface,
 * in BOTH schemes and BOTH gamuts. If any brand value drops a pair under its floor, this
 * goes red — a real engine finding surfaced at the exact place the grid is meant to prove it.
 *
 * (The engine solves foregrounds against the worst-case surface `surface-2`, so a pass here
 * on `surface` is the guaranteed-minimum; see `packages/oklch/src/palette.ts`.)
 */

// [label, brandColor] — chosen to hit the solver's documented hard paths.
const BRANDS: readonly [string, string][] = [
  ["mid blue", "#3b82f6"],
  ["mid red", "#ef4444"],
  ["violet", "#8b5cf6"],
  ["goldenrod (yellow)", "#d4a017"],
  ["pure yellow", "#ffff00"],
  ["cyan", "#00ffff"],
  ["magenta (high-chroma)", "#ff00ff"],
  ["pure green", "#00ff00"],
  ["near-white (too-light)", "#fafafa"],
  ["near-black", "#0a0a0a"],
  ["saturated orange", "#ff6a00"],
];

const GAMUTS = ["srgb", "p3"] as const;

/** Pull the two `oklch(...)` literals out of a baked `light-dark(<light>, <dark>)` value. */
const LIGHT_DARK = /^light-dark\((oklch\([^)]*\)),\s*(oklch\([^)]*\))\)$/;
function schemes(value: string): { light: string; dark: string } {
  const m = LIGHT_DARK.exec(value);
  if (!m) throw new Error(`not a light-dark(oklch, oklch) literal: ${value}`);
  return { light: m[1], dark: m[2] };
}

/** WCAG ratio between two color strings (each a baked `oklch(...)` literal). */
function ratio(fg: string, bg: string): number {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) throw new Error(`unparseable pair: ${fg} / ${bg}`);
  return contrastWCAG(f, b);
}

describe("cardSwatches — the engine solves an accessible card palette across brand values", () => {
  for (const gamut of GAMUTS) {
    for (const [label, brand] of BRANDS) {
      const style = cardSwatches(brand, { gamut });
      const surface = schemes(style["--surface"]);
      const text = schemes(style["--text"]);
      const border = schemes(style["--border"]);
      const accent = schemes(style["--accent"]);

      for (const scheme of ["light", "dark"] as const) {
        it(`[${gamut}/${scheme}] ${label}: text on surface ≥ 4.5:1`, () => {
          expect(ratio(text[scheme], surface[scheme])).toBeGreaterThanOrEqual(
            4.5,
          );
        });

        it(`[${gamut}/${scheme}] ${label}: border on surface ≥ 3:1 (non-text UI floor)`, () => {
          expect(ratio(border[scheme], surface[scheme])).toBeGreaterThanOrEqual(
            3,
          );
        });

        it(`[${gamut}/${scheme}] ${label}: accent on surface ≥ 3:1 (non-text UI floor)`, () => {
          expect(ratio(accent[scheme], surface[scheme])).toBeGreaterThanOrEqual(
            3,
          );
        });
      }
    }
  }
});
