import { describe, expect, it } from "vitest";

import { derivePalette } from "./derive";
import { DEFAULT_GAMUT, DEFAULT_RULES } from "./rules";
import { measureReceipt } from "./contrast";

const EXPECTED_PAIRS = [
  "body text",
  "muted text",
  "accent text",
  "on-accent",
  "focus ring",
  // The four status signals — colored text the preview paints, solved on surface-2 at the
  // accent-text target, so the receipt audits them too (QA-S13-1).
  "success",
  "error",
  "warning",
  "info",
];

// Hue-spanning seeds incl. the yellow + cyan stressers — the whole point of the receipt is
// that even these clear, because the engine solved them.
const SEEDS = ["#7c3aed", "#e11d48", "#eab308", "#06b6d4", "#16a34a"];

describe("measureReceipt", () => {
  it("reports one measured row per readable pair, in order", () => {
    const { light } = derivePalette("#7c3aed", DEFAULT_RULES, DEFAULT_GAMUT);
    const rows = measureReceipt(light.tokens);
    expect(rows.map((r) => r.label)).toEqual(EXPECTED_PAIRS);
    for (const row of rows) {
      expect(row.wcag).toBeGreaterThan(0);
      expect(row.apca).toBeGreaterThanOrEqual(0);
      expect(typeof row.passes).toBe("boolean");
    }
  });

  it("every pair passes for every hue, in BOTH schemes — the core guarantee", () => {
    for (const seed of SEEDS) {
      const palette = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT);
      for (const view of [palette.light, palette.dark]) {
        for (const row of measureReceipt(view.tokens)) {
          expect(
            row.passes,
            `${seed} ${view.scheme} ${row.label} — Lc ${row.apca.toFixed(1)}, ${row.wcag.toFixed(2)}:1`,
          ).toBe(true);
        }
      }
    }
  });

  it("even the safe fallback palette passes every pair", () => {
    const palette = derivePalette("not-a-color", DEFAULT_RULES, DEFAULT_GAMUT);
    expect(palette.isFallback).toBe(true);
    for (const view of [palette.light, palette.dark]) {
      expect(measureReceipt(view.tokens).every((r) => r.passes)).toBe(true);
    }
  });

  it("measured values change with the seed", () => {
    const a = measureReceipt(
      derivePalette("#7c3aed", DEFAULT_RULES, DEFAULT_GAMUT).light.tokens,
    );
    const b = measureReceipt(
      derivePalette("#eab308", DEFAULT_RULES, DEFAULT_GAMUT).light.tokens,
    );
    // The accent-text pair depends on the brand hue, so its measured contrast differs.
    const accentA = a.find((r) => r.label === "accent text")!;
    const accentB = b.find((r) => r.label === "accent text")!;
    expect(accentA.wcag).not.toBe(accentB.wcag);
  });
});
