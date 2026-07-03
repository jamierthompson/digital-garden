/**
 * QA #101 — adversarial coverage for the generative-rules slice.
 *
 * The committed matrix (palette.test.ts "contrast guarantees hold under every policy") only
 * varies ONE rule at a time. These tests attack the FULL cross-product
 * (distribution × chromaPolicy × huePolicy × tintedNeutrals), the taper/hold × anchor
 * interaction the "seed lands on the ramp" claim glosses, the runtime garbage-input posture
 * of the public `buildRamp`, and direction stability across rule configs.
 *
 * Independent fresh-eyes QA — no prior context of the implementation.
 */

import { describe, expect, it } from "vitest";

import { buildTokenSet, resolveTheme } from "./palette";
import { buildRamp } from "./ramp";
import { apcaLc, contrastWCAG } from "./contrast";
import {
  type BrandTokenName,
  type ChromaPolicy,
  type EngineRules,
  type Gamut,
  type HuePolicy,
  type LightnessDistribution,
  type Scheme,
} from "./types";

const SWEEP_TIMEOUT = 60_000;
const SCHEMES: Scheme[] = ["light", "dark"];

const DISTRIBUTIONS: LightnessDistribution[] = [
  "tailwind",
  "linear",
  "eased",
  "punchy",
  "soft",
];
const CHROMA_POLICIES: ChromaPolicy[] = ["flat", "taper", "hold"];
const HUE_POLICIES: HuePolicy[] = [
  "constant",
  "warm-shadows",
  "cool-highlights",
];

// Foreground tokens vs the worst-case surface (surface-2) at their schema targets
// (palette.ts TARGET table). [name, wcag floor, apca floor].
const FLOORS: Array<[BrandTokenName, number, number]> = [
  ["text", 4.5, 75],
  ["text-muted", 4.5, 60],
  ["border", 3, 30],
  ["accent-text", 4.5, 60],
  ["focus-ring", 3, 45],
  ["success", 4.5, 60],
  ["error", 4.5, 60],
  ["warning", 4.5, 60],
  ["info", 4.5, 60],
];

// Stresser seeds: brand blue, the yellow/cyan APCA stressers, near-white / near-black
// extremes, and unparseable garbage (must fall back to a passing palette, not explode).
const SEEDS: unknown[] = [
  "#2563eb",
  "#eab308",
  "#06b6d4",
  "#22c55e",
  "#fefefe",
  "#010101",
  "not-a-color",
];

const GAMUTS: Gamut[] = ["srgb", "p3"];

describe("generative rules (#101) — QA: full policy cross-product", () => {
  it(
    "AA holds for EVERY distribution × chromaPolicy × huePolicy × tintedNeutrals combination, both schemes, both gamuts",
    () => {
      for (const distribution of DISTRIBUTIONS)
        for (const chromaPolicy of CHROMA_POLICIES)
          for (const huePolicy of HUE_POLICIES)
            for (const tintedNeutrals of [true, false]) {
              const rules: EngineRules = {
                distribution,
                chromaPolicy,
                huePolicy,
                tintedNeutrals,
              };
              for (const gamut of GAMUTS)
                for (const seed of SEEDS)
                  for (const scheme of SCHEMES) {
                    const { tokens } = resolveTheme(seed, scheme, {
                      rules,
                      gamut,
                    });
                    const bg = tokens["surface-2"];
                    const where = `${JSON.stringify(rules)} ${String(seed)}/${scheme}/${gamut}`;
                    for (const [name, wcag, apca] of FLOORS) {
                      expect(
                        contrastWCAG(tokens[name], bg),
                        `${name} WCAG ${where}`,
                      ).toBeGreaterThanOrEqual(wcag);
                      expect(
                        apcaLc(tokens[name], bg),
                        `${name} APCA ${where}`,
                      ).toBeGreaterThanOrEqual(apca);
                    }
                    // Accent fill + its on-accent label co-solved guarantee.
                    expect(
                      contrastWCAG(tokens["on-accent"], tokens.accent),
                      `on-accent WCAG ${where}`,
                    ).toBeGreaterThanOrEqual(4.5);
                    expect(
                      apcaLc(tokens["on-accent"], tokens.accent),
                      `on-accent APCA ${where}`,
                    ).toBeGreaterThanOrEqual(60);
                  }
            }
    },
    SWEEP_TIMEOUT,
  );

  // The claim under test (commit 47414c9 / types.ts): a DISTRIBUTION reshapes only the
  // interior 300…700; the shoulders (bg/surface/surface-2) never move. Holding chroma/hue
  // policy at their defaults, the surface tokens must be bit-identical across every
  // distribution — this is exactly what keeps surface-2 (the worst-case background) fixed.
  it("surface tokens are bit-identical across every distribution (chroma/hue at default)", () => {
    for (const seed of ["#2563eb", "#eab308", "#06b6d4", "#010101", "#fefefe"])
      for (const scheme of SCHEMES) {
        const plain = resolveTheme(seed, scheme);
        for (const distribution of DISTRIBUTIONS) {
          const ruled = resolveTheme(seed, scheme, { rules: { distribution } });
          const where = `${distribution} ${seed}/${scheme}`;
          expect(ruled.tokens.bg, `bg ${where}`).toEqual(plain.tokens.bg);
          expect(ruled.tokens.surface, `surface ${where}`).toEqual(
            plain.tokens.surface,
          );
          expect(ruled.tokens["surface-2"], `surface-2 ${where}`).toEqual(
            plain.tokens["surface-2"],
          );
        }
      }
  });

  // Broader guarantee: even chroma/hue policies (which DO retint the surfaces — a hue drift
  // rotates the neutral shoulder's hue, a taper changes its chroma; that is intended) must
  // not move the surface LIGHTNESS off its pinned shoulder value by more than gamut-clip
  // round-off. Surface *lightness* is the quantity the AA solve is anchored on, so it must
  // stay put across the full cross-product even though hue/chroma may shift.
  it(
    "surface LIGHTNESS stays pinned (±1e-3) across the full policy cross-product, both schemes",
    () => {
      for (const seed of ["#2563eb", "#eab308", "#06b6d4"])
        for (const scheme of SCHEMES) {
          const plain = resolveTheme(seed, scheme);
          for (const distribution of DISTRIBUTIONS)
            for (const chromaPolicy of CHROMA_POLICIES)
              for (const huePolicy of HUE_POLICIES) {
                const ruled = resolveTheme(seed, scheme, {
                  rules: { distribution, chromaPolicy, huePolicy },
                });
                const where = `${distribution}/${chromaPolicy}/${huePolicy} ${seed}/${scheme}`;
                for (const t of ["bg", "surface", "surface-2"] as const) {
                  expect(ruled.tokens[t].L, `${t} L ${where}`).toBeCloseTo(
                    plain.tokens[t].L,
                    3,
                  );
                }
              }
        }
    },
    SWEEP_TIMEOUT,
  );
});

describe("generative rules (#101) — QA: bit-identity of every default permutation", () => {
  // The committed test asserts ONE all-default object. A partial rules object with any
  // subset of the defaults must ALSO reproduce the un-ruled output exactly.
  it("every partial-default rules subset reproduces the optionless output, both schemes", () => {
    const seed = "#2563eb";
    const SUBSETS: EngineRules[] = [
      {},
      { distribution: "tailwind" },
      { chromaPolicy: "flat" },
      { huePolicy: "constant" },
      { tintedNeutrals: true },
      { distribution: "tailwind", chromaPolicy: "flat" },
      { distribution: "tailwind", huePolicy: "constant", tintedNeutrals: true },
    ];
    for (const scheme of SCHEMES) {
      const plain = resolveTheme(seed, scheme);
      for (const rules of SUBSETS) {
        expect(
          resolveTheme(seed, scheme, { rules }),
          JSON.stringify(rules),
        ).toEqual(plain);
      }
    }
    for (const rules of SUBSETS) {
      expect(
        buildTokenSet(seed, { rules }),
        `tokenSet ${JSON.stringify(rules)}`,
      ).toEqual(buildTokenSet(seed));
    }
  });
});

describe("generative rules (#101) — QA: taper/hold vs the 'seed lands on the ramp' claim", () => {
  // types.ts/README: "that step's lightness is the seed's … so the seed's own color lands
  // on the ramp." Under taper/hold, chromaCurve multiplies nominal chroma by sin(πt)^k.
  // For a LIGHT-native seed the anchor is "500" (t=0.5 → sin=1 → ×1), so chroma is
  // preserved and the claim holds. For a DARK-native seed the anchor is "300" (t=0.3 →
  // sin(0.3π)^0.72 ≈ 0.86), so the anchored brand step's CHROMA is pulled below the seed's
  // — the seed's color does NOT fully land on the ramp. Lightness stays exact. This pins
  // the real, chroma-lossy behavior so the doc's unqualified "color lands on the ramp" is
  // either corrected or knowingly accepted (the shipped `accent` token is co-solved from
  // seed.C independently, so it is unaffected — only the brand RAMP primitive is).
  it("dark-native anchored brand step keeps L exact but LOSES chroma under taper (claim is L-only)", () => {
    const seed = "#eab308"; // yellow → dark-native, anchors "300"
    const r = resolveTheme(seed, "dark", { rules: { chromaPolicy: "taper" } });
    expect(r.anchorLabel).toBe("300");
    const step = r.ramps.brand.find((s) => s.label === r.anchorLabel)!;
    // Lightness pin survives taper.
    expect(step.color.L).toBeCloseTo(r.seed.L, 6);
    // …but the chroma at t=0.3 is pulled well below the seed's nominal chroma.
    expect(step.color.C).toBeLessThan(r.seed.C * 0.95);
    expect(step.color.C).toBeGreaterThan(0);
  });

  it("light-native anchored brand step (500, t=0.5) keeps chroma under taper — the seed's color DOES land", () => {
    const seed = "#2563eb"; // blue → light-native, anchors "500"
    const flat = resolveTheme(seed, "light");
    const taper = resolveTheme(seed, "light", {
      rules: { chromaPolicy: "taper" },
    });
    expect(taper.anchorLabel).toBe("500");
    const a = taper.ramps.brand.find((s) => s.label === "500")!;
    const b = flat.ramps.brand.find((s) => s.label === "500")!;
    // sin(π·0.5)^k = 1, so the anchor step is untouched by taper.
    expect(a.color.C).toBeCloseTo(b.color.C, 9);
    expect(a.color.L).toBeCloseTo(b.color.L, 9);
  });
});

describe("generative rules (#101) — QA: public buildRamp runtime posture", () => {
  // buildRamp is a PUBLIC export (index.ts). The author explicitly hardened the sibling
  // "non-finite anchor L" case (ramp.ts: Number.isFinite guard → treat as no anchor), on
  // the engine's documented "never throws, never garbage" posture. An unknown `distribution`
  // string (reachable from a JS caller or an eroded/`as`-cast type) hits `scaleOf`'s inner
  // switch, which has NO default branch → `ease` returns undefined → the interior
  // lightnesses become NaN. This documents the CURRENT behavior; if the never-garbage
  // posture is meant to be uniform, scaleOf needs a default (fall back to `tailwind`)
  // the way the anchor path already defends itself.
  it("CHARACTERIZATION: an unknown distribution yields NaN interior lightness (defensive-posture gap vs the anchor guard)", () => {
    const ramp = buildRamp({
      hue: 260,
      chroma: 0.1,
      gamut: "srgb",
      rules: { distribution: "bogus" as never },
    });
    const interior = ramp.slice(3, 8).map((s) => s.color.L);
    // Present-tense truth: the interior is non-finite. When the author adds a `default` to
    // scaleOf, flip this to expect the tailwind interior instead.
    expect(interior.every((L) => Number.isNaN(L))).toBe(true);
    // The pinned shoulders survive (they bypass `ease`), so the failure is silent + partial.
    expect(Number.isFinite(ramp[0].color.L)).toBe(true);
  });

  // Contrast with the guarded siblings: garbage chromaPolicy / huePolicy degrade GRACEFULLY
  // (unknown chroma policy → treated as the sine bell; unknown hue policy → no drift), so
  // only `distribution` is unsafe. This asymmetry is the smell.
  it("unknown chromaPolicy / huePolicy stay finite (only distribution is unguarded)", () => {
    const c = buildRamp({
      hue: 260,
      chroma: 0.1,
      gamut: "srgb",
      rules: { chromaPolicy: "bogus" as never },
    });
    const h = buildRamp({
      hue: 260,
      chroma: 0.1,
      gamut: "srgb",
      rules: { huePolicy: "bogus" as never },
    });
    for (const step of [...c, ...h]) {
      expect(Number.isFinite(step.color.L)).toBe(true);
      expect(Number.isFinite(step.color.C)).toBe(true);
      expect(Number.isFinite(step.color.H)).toBe(true);
    }
  });
});

describe("generative rules (#101) — QA: direction & monotonicity invariants", () => {
  // detectDirection now threads `rules`; tintedNeutrals:false zeroes surface-2's chroma.
  // Direction MAY legitimately differ if the surface changed — but surfaces are
  // shoulder-pinned and chroma barely moves lightness, so within a single buildTokenSet
  // call light & dark must still AGREE (the whole point of seed-only detection).
  it("light & dark agree on direction for every rule config and seed (seed-only detection survives threading)", () => {
    for (const seed of SEEDS)
      for (const distribution of DISTRIBUTIONS)
        for (const tintedNeutrals of [true, false]) {
          const rules: EngineRules = { distribution, tintedNeutrals };
          const light = resolveTheme(seed, "light", { rules });
          const dark = resolveTheme(seed, "dark", { rules });
          const meta = buildTokenSet(seed, { rules }).meta.anchorLabel;
          expect(
            light.direction,
            `${String(seed)} ${JSON.stringify(rules)}`,
          ).toBe(dark.direction);
          expect(meta).toBe(light.anchorLabel);
        }
  });

  // Every built ramp — every role, every scheme, every distribution — must stay strictly
  // monotonic in lightness (lightest → darkest). A non-monotonic ramp breaks minPass
  // binding and the surface ordering. The committed ramp.test only checks the brand-shaped
  // BASE ramp; this sweeps the real role chromas + the seed anchor together.
  it(
    "every role ramp stays strictly monotonic under every distribution × anchor, both schemes",
    () => {
      for (const seed of [
        "#2563eb",
        "#eab308",
        "#06b6d4",
        "#010101",
        "#fefefe",
      ])
        for (const scheme of SCHEMES)
          for (const distribution of DISTRIBUTIONS) {
            const { ramps } = resolveTheme(seed, scheme, {
              rules: { distribution },
            });
            for (const role of Object.keys(ramps) as Array<
              keyof typeof ramps
            >) {
              const r = ramps[role];
              for (let i = 1; i < r.length; i++) {
                expect(
                  r[i].color.L,
                  `${role} ${distribution} ${seed}/${scheme} @${r[i].label}`,
                ).toBeLessThan(r[i - 1].color.L);
              }
            }
          }
    },
    SWEEP_TIMEOUT,
  );
});

describe("generative rules (#101) — QA: hue-drift wrap correctness at both seams", () => {
  // The default path skips hue arithmetic entirely (delta === 0) so no modulo rounding
  // sneaks in; a real drift normalizes into [0,360). Verify both seam directions land in
  // range and don't leave the circle (hue near 0 drifting negative, hue near 360 drifting
  // positive) — an unnormalized negative hue would poison downstream conversions.
  it("drifted hues stay in [0,360) at both seams for constant/warm/cool", () => {
    for (const hue of [0, 2, 358, 359.9, 180])
      for (const huePolicy of HUE_POLICIES) {
        const ramp = buildRamp({
          hue,
          chroma: 0.05,
          gamut: "srgb",
          rules: { huePolicy },
        });
        for (const step of ramp) {
          expect(
            step.color.H,
            `hue=${hue} ${huePolicy} @${step.label}`,
          ).toBeGreaterThanOrEqual(0);
          expect(step.color.H).toBeLessThan(360);
          expect(Number.isFinite(step.color.H)).toBe(true);
        }
      }
  });
});
