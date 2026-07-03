// Adversarial QA (QA-S13) for the headless derivation core. Attacks the boundaries the
// author's happy-path suite skipped: hostile seeds, the parse-honesty contract the UI's
// `aria-invalid` rides on, and the full rule cross-product. Pure — no DOM.

import { describe, expect, it } from "vitest";

import {
  BRAND_TOKEN_NAMES,
  parseColor,
  RAMP_LABELS,
  RAMP_ROLES,
  type ChromaPolicy,
  type Gamut,
  type HuePolicy,
  type LightnessDistribution,
} from "@garden/oklch";

import { derivePalette, parseSeed } from "./derive";
import { DEFAULT_GAMUT, DEFAULT_RULES } from "./rules";

// A hostile roster the happy path never sends through: malformed, out-of-range, unicode,
// pathological-length, and the engine's documented clamp boundaries (near-white/black,
// achromatic). NONE may throw; every one must yield a complete palette.
const HOSTILE_SEEDS: readonly string[] = [
  "",
  "   ",
  "\t\n",
  "#",
  "#f",
  "#ff",
  "#ffff", // 4-digit hex — not a valid CSS form, must fall back honestly
  "#fffffff", // 7 digits
  "#ffffffff", // 8-digit hex (alpha) — engine drops alpha; must not throw
  "#zzz",
  "#ZZZZZZ",
  "rgb(999 -5 300)", // out-of-range channels
  "rgb(0,0,0)",
  "rgba(255 255 255 / 0.5)",
  "oklch(2 5 999)", // L, C, H all out of nominal range
  "oklch(-1 -1 -1)",
  "oklch(x y z)",
  "hsl(0 0 0)", // unsupported color space
  "not-a-color",
  "🎨🌈",
  "  #16a34a  ", // surrounding whitespace
  "RGB(124 58 237)", // uppercase function
  "#16A34A", // uppercase hex
  "a".repeat(10000), // pathological length
];

// Boundary + achromatic seeds that stress the anchor-L clamp (~0.15…0.98) and the
// tinted-neutral / brand-ramp convergence path.
const BOUNDARY_SEEDS: readonly string[] = [
  "#000",
  "#000000",
  "#fff",
  "#ffffff",
  "#808080",
  "#010101",
  "#fefefe",
  "oklch(0 0 0)",
  "oklch(1 0 0)",
  "oklch(0.5 0 120)", // achromatic mid
];

describe("QA-S13 · derivePalette — hostile seeds never break the tool", () => {
  it.each([...HOSTILE_SEEDS, ...BOUNDARY_SEEDS])(
    "yields a complete, non-throwing palette for %j",
    (seed) => {
      const palette = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT);
      // Structurally complete regardless of validity.
      expect(palette.rows).toHaveLength(BRAND_TOKEN_NAMES.length);
      expect(palette.rows.map((r) => r.name)).toEqual([...BRAND_TOKEN_NAMES]);
      for (const view of [palette.light, palette.dark]) {
        expect(Object.keys(view.ramps)).toEqual([...RAMP_ROLES]);
        for (const role of RAMP_ROLES) {
          expect(view.ramps[role].map((s) => s.label)).toEqual([
            ...RAMP_LABELS,
          ]);
          for (const step of view.ramps[role]) {
            expect(Number.isFinite(step.color.L)).toBe(true);
            expect(Number.isFinite(step.color.C)).toBe(true);
            expect(Number.isFinite(step.color.H)).toBe(true);
          }
        }
      }
    },
  );

  it("isFallback is HONEST — agrees with parseSeed and the engine parser for every seed", () => {
    // The UI wires `aria-invalid` off parseSeed but paints the palette off derivePalette;
    // if these two ever disagreed, the input would claim valid while showing a fallback (or
    // vice versa). They must agree with each other AND with the engine's own parser.
    for (const seed of [...HOSTILE_SEEDS, ...BOUNDARY_SEEDS]) {
      const viaParse = parseSeed(seed).isFallback;
      const viaDerive = derivePalette(
        seed,
        DEFAULT_RULES,
        DEFAULT_GAMUT,
      ).isFallback;
      const viaEngine = parseColor(seed) === null;
      expect(
        viaParse,
        `parseSeed vs derive disagree for ${JSON.stringify(seed)}`,
      ).toBe(viaDerive);
      expect(
        viaParse,
        `parseSeed vs engine parser disagree for ${JSON.stringify(seed)}`,
      ).toBe(viaEngine);
    }
  });

  it("a valid seed is never mislabeled as fallback (near-white/black/achromatic)", () => {
    for (const seed of ["#000", "#fff", "#808080", "oklch(0.5 0 120)"]) {
      expect(
        derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT).isFallback,
        seed,
      ).toBe(false);
    }
  });
});

describe("QA-S13 · rule cross-product — every combination derives cleanly", () => {
  const DISTS: readonly LightnessDistribution[] = [
    "tailwind",
    "linear",
    "eased",
    "punchy",
    "soft",
  ];
  const CHROMAS: readonly ChromaPolicy[] = ["flat", "taper", "hold"];
  const HUES: readonly HuePolicy[] = [
    "constant",
    "warm-shadows",
    "cool-highlights",
  ];
  const GAMUTS: readonly Gamut[] = ["srgb", "p3"];

  // 180 full engine runs — generous timeout so it can't flake under a loaded parallel gate
  // (the engine's own QA-102 grid test uses the same guard).
  it(
    "all 5×3×3×2×2 = 180 rule combinations: 11 steps + strictly monotonic lightness, no throw",
    { timeout: 30000 },
    () => {
      let combos = 0;
      for (const distribution of DISTS)
        for (const chromaPolicy of CHROMAS)
          for (const huePolicy of HUES)
            for (const tintedNeutrals of [true, false])
              for (const gamut of GAMUTS) {
                combos++;
                const p = derivePalette(
                  "#7c3aed",
                  { distribution, chromaPolicy, huePolicy, tintedNeutrals },
                  gamut,
                );
                const tag = `${distribution}/${chromaPolicy}/${huePolicy}/tn=${tintedNeutrals}/${gamut}`;
                for (const view of [p.light, p.dark]) {
                  for (const role of RAMP_ROLES) {
                    const ramp = view.ramps[role];
                    expect(ramp, `${tag} ${role} step count`).toHaveLength(11);
                    const Ls = ramp.map((s) => s.color.L);
                    for (let i = 1; i < Ls.length; i++) {
                      // 50 is lightest, 950 darkest → strictly decreasing L.
                      expect(
                        Ls[i],
                        `${tag} ${view.scheme} ${role} not monotonic at step ${i}`,
                      ).toBeLessThan(Ls[i - 1]);
                    }
                  }
                }
              }
      expect(combos).toBe(180);
    },
  );

  it("tintedNeutrals:false forces a pure achromatic neutral ramp in BOTH schemes", () => {
    const p = derivePalette(
      "#7c3aed",
      { ...DEFAULT_RULES, tintedNeutrals: false },
      DEFAULT_GAMUT,
    );
    for (const view of [p.light, p.dark]) {
      for (const step of view.ramps.neutral) {
        expect(step.color.C, `${view.scheme} neutral ${step.label}`).toBe(0);
      }
    }
  });
});
