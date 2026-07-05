import { describe, expect, it } from "vitest";
import {
  buildTokenSet,
  formatOklch,
  tokenSetToCss,
  type EngineRules,
} from "@garden/oklch";

import { washBgValue } from "./washBg";

// Hue-spanning + hostile seeds: the yellow/cyan stressers, an achromatic grey, near-black/
// near-white, the low-chroma light-yellow class, and a garbage seed (the engine's fallback).
const SEEDS = [
  "#eab308", // yellow stresser
  "#06b6d4", // cyan stresser
  "#808080", // achromatic mid grey
  "#010101", // near-black
  "#fefefe", // near-white
  "#faf3c0", // low-chroma light yellow
  "not-a-color", // fallback path
];

// washBg's whole reason to exist post-#160: it is the ONE derivation of the page wash, reading
// the engine's `--bg` token directly with NO app-layer chroma constant (the b2982a8 stopgap
// removal). These tests lock that single-source invariant — re-introducing a local chroma
// override, or drifting the format, would fail here.
describe("washBgValue — the single source for the page wash (#160)", () => {
  it.each(SEEDS)(
    "equals the engine's own baked --bg declaration for %s",
    (seed) => {
      const set = buildTokenSet(seed, { gamut: "srgb" });
      const wash = washBgValue(set);

      // The value the engine serializes into every surface's `--bg` — the wash must be byte-
      // identical to it, so the page-spanning wash can never disagree with the surfaces on it.
      const bgLine = tokenSetToCss(set, ":root")
        .split("\n")
        .find((line) => line.trim().startsWith("--bg:"));
      expect(bgLine, `no --bg line for ${seed}`).toBeDefined();
      const engineBg = bgLine!
        .trim()
        .replace(/^--bg:\s*/, "")
        .replace(/;$/, "");

      expect(wash).toBe(engineBg);
    },
  );

  it("carries the engine's neutral chroma directly — no app-layer override", () => {
    // A tinted seed's wash is chromatic (the engine's raised neutral chroma), and turning
    // tinted neutrals OFF makes the wash achromatic — proof the tint comes from the engine, not
    // a constant baked into washBg. A local chroma override would make both cases identical.
    const tinted = washBgValue(buildTokenSet("#06b6d4", { gamut: "srgb" }));
    const rules: EngineRules = { tintedNeutrals: false };
    const flat = washBgValue(
      buildTokenSet("#06b6d4", { gamut: "srgb", rules }),
    );
    expect(tinted).not.toBe(flat);
    // The wash IS `light-dark(<bg.light>, <bg.dark>)` of the token set, nothing else.
    const set = buildTokenSet("#06b6d4", { gamut: "srgb" });
    expect(washBgValue(set)).toBe(
      `light-dark(${formatOklch(set.tokens.bg.light)}, ${formatOklch(set.tokens.bg.dark)})`,
    );
  });
});
