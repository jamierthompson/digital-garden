import { describe, expect, it } from "vitest";
import { derivePalette } from "./derive";
import { DEFAULT_GAMUT, DEFAULT_RULES } from "./rules";
import { measureReceipt } from "./contrast";
import { checkContrast } from "@garden/oklch";

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

// Adversarial QA (QA-S13) for the contrast receipt — the module's flagship "audited proof"
// surface. The receipt's on-screen claim is absolute: "every readable pair clears its WCAG
// floor and APCA target, in both schemes. That's the guarantee." These tests probe whether
// that claim is COMPLETE and whether the measurement survives hostile input. Pure — no DOM.

const HUE_SPAN = ["#7c3aed", "#e11d48", "#eab308", "#06b6d4", "#16a34a"];
const STATUS_TOKENS = ["success", "error", "warning", "info"] as const;

// The engine solves the status TEXT tokens (`<status>-text`, #160) as `auto` tokens against the
// worst surface (`surface-selected`) with the SAME target as accent text ({ wcag: 4.5, apca: 60 }
// — CONTRAST_TARGETS.accentText). So they are a genuine "readable-on-surface" guarantee,
// identical in kind to the accent-text pair the receipt already shows. (The `<status>` FILLS are
// 3:1 UI signals, not readable text — audited on the card, not here.)
const STATUS_TARGET = { wcag: 4.5, apca: 60 };

describe("QA-S13 · the status signals ARE a readable guarantee the engine makes", () => {
  it("every status TEXT token clears its target on surface-selected, all hues, both schemes", () => {
    // This is the safety half: proving the fix (auditing the status-text rows) is sound because
    // the engine already guarantees these pairs.
    for (const seed of HUE_SPAN) {
      const palette = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT);
      for (const view of [palette.light, palette.dark]) {
        for (const token of STATUS_TOKENS) {
          const { wcag, apca, passes } = checkContrast(
            view.tokens[`${token}-text`],
            view.tokens["surface-selected"],
            STATUS_TARGET,
          );
          expect(
            passes,
            `${seed} ${view.scheme} ${token}-text — ${wcag.toFixed(2)}:1 / Lc ${apca.toFixed(1)}`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("QA-S13 · FINDING QA-S13-1 — the receipt covers the status text pairs", () => {
  // The Preview panel paints all four status signals as colored TEXT (`color: var(--<status>-
  // text)`) on the generated surface, and the receipt claims to audit "every readable pair" —
  // so measureReceipt must report a row for each. This guards against the audit under-reporting
  // what the tool visibly renders as text.
  it("reports a receipt row for every status signal the preview paints as text", () => {
    const { light } = derivePalette("#7c3aed", DEFAULT_RULES, DEFAULT_GAMUT);
    const labels = measureReceipt(light.tokens).map((r) =>
      r.label.toLowerCase(),
    );
    for (const token of STATUS_TOKENS) {
      expect(
        labels.some((l) => l.includes(token)),
        `receipt has no row covering "${token}" — status text is unaudited`,
      ).toBe(true);
    }
  });
});

describe("QA-S13 · measureReceipt survives hostile & fallback input", () => {
  it("returns finite numbers and a boolean pass for the safe-fallback palette", () => {
    for (const seed of ["", "not-a-color", "🎨", "oklch(2 5 999)"]) {
      const palette = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT);
      const rows = measureReceipt(palette.light.tokens);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(Number.isFinite(row.wcag), `${seed} wcag`).toBe(true);
        expect(Number.isFinite(row.apca), `${seed} apca`).toBe(true);
        expect(typeof row.passes, `${seed} passes`).toBe("boolean");
        expect(row.wcag).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("the fallback palette still clears every pair the receipt DOES show", () => {
    const palette = derivePalette("garbage", DEFAULT_RULES, DEFAULT_GAMUT);
    expect(palette.isFallback).toBe(true);
    for (const view of [palette.light, palette.dark]) {
      expect(measureReceipt(view.tokens).every((r) => r.passes)).toBe(true);
    }
  });
});
