/**
 * Independent adversarial QA for the harmony semantic blocks (#334) — the 21 tokens that bind
 * the harmony tier into the guarded surface.
 *
 * The author's own suites check the blocks against the WORST-CASE surface with a five-seed
 * matrix (`palette.test.ts`) and pin the annex↔surface seam (`harmony-tier.test.ts`). This file
 * attacks what those skip: every one of the FIVE standard surfaces rather than only the
 * worst case, a hostile seed matrix (near-black/near-white, achromatic, out-of-gamut chroma,
 * alpha-carrying, hue-wrap boundaries, unparseable garbage) crossed with both gamuts and the
 * `tintedNeutrals` rule, the hue-rotation boundary math, determinism, and the two equivalence
 * claims the refactor rests on.
 */

import { describe, expect, it } from "vitest";

import { buildTokenSet, resolveTheme } from "./palette";
import { minPass } from "./binding";
import { buildRamp } from "./ramp";
import { inGamut } from "./gamut";
import { apcaLc, contrastWCAG } from "./contrast";
import { CONTRAST_TARGETS } from "./targets";
import { resolveHarmonyTier } from "./harmony-tier";
import {
  HARMONY_HUES,
  HARMONY_HUE_ANGLES,
  rotate,
  type HarmonyHue,
} from "./harmony";
import type {
  EngineRules,
  Gamut,
  OkLCH,
  Scheme,
  ThemeTokenName,
} from "./types";

// Same budget and rationale as `palette.test.ts`'s sweeps: these resolve hundreds of full
// themes and must not flake when the suite runs under CPU contention.
const SWEEP_TIMEOUT = 30_000;

const SCHEMES: Scheme[] = ["light", "dark"];

/**
 * ALL FIVE text-bearing surfaces, not just the worst case. The binding solves against
 * `surface-selected` and the engine's claim is that a pass there holds on every surface
 * (`resolveTheme`, packages/oklch/src/palette.ts:626-629) — this list is what turns that
 * claim into a measurement.
 */
const SURFACES = [
  "background",
  "surface",
  "surface-elevated",
  "surface-hover",
  "surface-selected",
] as const satisfies readonly ThemeTokenName[];

/** The hostile seed matrix — the inputs the happy path skips. */
const SEEDS: readonly { label: string; seed: unknown }[] = [
  { label: "brand blue", seed: "#3b82f6" },
  { label: "amber (the APCA stresser)", seed: "#eab308" },
  { label: "cyan (the APCA stresser)", seed: "#06b6d4" },
  { label: "pure white", seed: "#ffffff" },
  { label: "pure black", seed: "#000000" },
  { label: "near-white", seed: "oklch(0.99 0.02 90)" },
  { label: "near-black", seed: "oklch(0.03 0.01 200)" },
  { label: "achromatic mid grey (C=0)", seed: "oklch(0.5 0 0)" },
  { label: "out-of-gamut chroma", seed: "oklch(0.75 0.37 145)" },
  { label: "hue 0 boundary", seed: "oklch(0.6 0.2 0)" },
  { label: "hue 359.9 boundary", seed: "oklch(0.6 0.2 359.9)" },
  { label: "hue 350 (wraps forward)", seed: "hsl(350 100% 50%)" },
  { label: "hue 15 (wraps backward)", seed: "hsl(15 100% 50%)" },
  { label: "alpha-carrying", seed: "rgba(12, 200, 90, 0.35)" },
  { label: "garbage string", seed: "not-a-color" },
  { label: "null", seed: null },
  { label: "undefined", seed: undefined },
  { label: "number", seed: 42 },
  { label: "NaN", seed: Number.NaN },
  { label: "empty string", seed: "" },
  { label: "object", seed: {} },
  { label: "array", seed: [] },
];

const RULE_SETS: readonly { label: string; rules: EngineRules }[] = [
  { label: "defaults", rules: {} },
  { label: "tintedNeutrals:false", rules: { tintedNeutrals: false } },
];

const GAMUTS: readonly Gamut[] = ["srgb", "p3"];

const fillName = (hue: HarmonyHue) => `harmony-${hue}-fill` as ThemeTokenName;
const textName = (hue: HarmonyHue) => `harmony-${hue}-text` as ThemeTokenName;
const anchorName = (hue: HarmonyHue) => `harmony-${hue}` as ThemeTokenName;

const finite = (c: OkLCH): boolean =>
  Number.isFinite(c.L) && Number.isFinite(c.C) && Number.isFinite(c.H);

describe("harmony blocks — contrast holds on EVERY surface, not just the solved one", () => {
  // The graded tokens carry a contrast CLAIM: `-fill` at the `ui` tier (WCAG 3:1 + APCA
  // Lc 45) and `-text` at `accentText` (4.5:1 + Lc 60). `minPass` solves them against
  // `surface-selected` only; the promise is that this transitively covers the other four
  // surfaces. Measure it directly — and measure it on the seeds most likely to break it.
  const GRADED = [
    { suffix: "fill", name: fillName, target: CONTRAST_TARGETS.ui },
    { suffix: "text", name: textName, target: CONTRAST_TARGETS.accentText },
  ] as const;

  it.each(SCHEMES)(
    "every harmony -fill and -text clears its floor on all five surfaces (%s scheme)",
    (scheme) => {
      for (const { label, seed } of SEEDS)
        for (const { label: ruleLabel, rules } of RULE_SETS) {
          const { tokens } = resolveTheme(seed, scheme, { rules });
          for (const hue of HARMONY_HUES)
            for (const { suffix, name, target } of GRADED) {
              const color = tokens[name(hue)];
              for (const surface of SURFACES) {
                const bg = tokens[surface];
                const where = `${label}/${ruleLabel}/${scheme}/harmony-${hue}-${suffix} on ${surface}`;
                expect(
                  contrastWCAG(color, bg),
                  `${where} WCAG`,
                ).toBeGreaterThanOrEqual(target.wcag);
                expect(
                  apcaLc(color, bg),
                  `${where} APCA`,
                ).toBeGreaterThanOrEqual(target.apca);
              }
            }
        }
    },
    SWEEP_TIMEOUT,
  );

  it.each(GAMUTS)(
    "holds in the %s gamut too, and every harmony token stays IN that gamut",
    (gamut) => {
      for (const { label, seed } of SEEDS)
        for (const scheme of SCHEMES) {
          const { tokens } = resolveTheme(seed, scheme, { gamut });
          for (const hue of HARMONY_HUES) {
            // The decorative anchor makes no contrast claim, but it must still be a real,
            // paintable, in-gamut color — gamut-map-before-contrast is an engine invariant.
            for (const name of [anchorName, fillName, textName]) {
              const color = tokens[name(hue)];
              const where = `${label}/${gamut}/${scheme}/${name(hue)}`;
              expect(finite(color), `${where} finite`).toBe(true);
              expect(inGamut(color, gamut), `${where} in gamut`).toBe(true);
            }
            for (const { suffix, name, target } of GRADED) {
              const color = tokens[name(hue)];
              for (const surface of SURFACES) {
                const where = `${label}/${gamut}/${scheme}/harmony-${hue}-${suffix} on ${surface}`;
                expect(
                  contrastWCAG(color, tokens[surface]),
                  `${where} WCAG`,
                ).toBeGreaterThanOrEqual(target.wcag);
                expect(
                  apcaLc(color, tokens[surface]),
                  `${where} APCA`,
                ).toBeGreaterThanOrEqual(target.apca);
              }
            }
          }
        }
    },
    SWEEP_TIMEOUT,
  );
});

describe("harmony blocks — the never-throws / fallback posture", () => {
  it("never throws on any hostile input, in either scheme or either entry point", () => {
    for (const { label, seed } of SEEDS)
      for (const scheme of SCHEMES) {
        expect(() => resolveTheme(seed, scheme), label).not.toThrow();
        expect(() => resolveHarmonyTier(seed, scheme), label).not.toThrow();
        expect(() => buildTokenSet(seed), label).not.toThrow();
      }
  });

  it("reports isFallback for unparseable input and still emits all 21 harmony tokens", () => {
    for (const seed of ["not-a-color", null, undefined, 42, "", {}, []]) {
      const light = resolveTheme(seed, "light");
      expect(light.isFallback, String(seed)).toBe(true);
      for (const hue of HARMONY_HUES)
        for (const name of [anchorName, fillName, textName]) {
          expect(
            light.tokens[name(hue)],
            `${String(seed)}/${name(hue)}`,
          ).toBeDefined();
          expect(
            finite(light.tokens[name(hue)]),
            `${String(seed)}/${name(hue)}`,
          ).toBe(true);
        }
    }
  });

  it("emits NO NaN component in any harmony token, for any seed", () => {
    for (const { label, seed } of SEEDS)
      for (const scheme of SCHEMES) {
        const { tokens } = resolveTheme(seed, scheme);
        for (const hue of HARMONY_HUES)
          for (const name of [anchorName, fillName, textName]) {
            const c = tokens[name(hue)];
            expect(finite(c), `${label}/${scheme}/${name(hue)}`).toBe(true);
            // Hue must be a normalized angle, never a wrapped-negative or >360 value.
            expect(
              c.H,
              `${label}/${scheme}/${name(hue)} H range`,
            ).toBeGreaterThanOrEqual(0);
            expect(c.H, `${label}/${scheme}/${name(hue)} H range`).toBeLessThan(
              360,
            );
          }
      }
  });
});

describe("harmony blocks — hue rotation at the wrap boundary", () => {
  it("normalizes a rotation that crosses 0/360 in both directions", () => {
    // The two cases a naive `hue + delta` gets wrong.
    expect(rotate(350, 30)).toBeCloseTo(20, 10);
    expect(rotate(15, -30)).toBeCloseTo(345, 10);
    expect(rotate(0, -120)).toBeCloseTo(240, 10);
    expect(rotate(180, 210)).toBeCloseTo(30, 10);
    expect(rotate(360, 0)).toBeCloseTo(0, 10);
    // Non-normalized input is normalized too, not merely offset.
    expect(rotate(-10, 0)).toBeCloseTo(350, 10);
    expect(rotate(720, 45)).toBeCloseTo(45, 10);
  });

  it("each harmony ramp really sits at the seed hue plus its documented offset", () => {
    // Guards the wiring, not just the helper: a transposed offset table or a role/hue
    // mismatch in `buildRamps` would leave every contrast sweep green while shipping the
    // wrong colors. Checked on seeds whose hue forces every offset across the wrap.
    //
    // A step that had to be gamut-mapped does not land on the requested hue EXACTLY — the
    // mapping trades a little hue for gamut membership (measured max ≈ 4.1° here, and the
    // accent ramp shows the same shift on its own out-of-gamut steps, so this is the
    // engine's mapping behavior, not something the harmony wiring introduced). An
    // IN-GAMUT step has no such excuse and must be exact.
    const MAX_MAPPED_HUE_DRIFT = 5;
    for (const seedHue of [350, 15, 0, 200]) {
      const { ramps, seed } = resolveTheme(
        `oklch(0.6 0.15 ${seedHue})`,
        "light",
      );
      for (const hue of HARMONY_HUES) {
        const expected = rotate(seed.H, HARMONY_HUE_ANGLES[hue].offset);
        const step = ramps[`harmony-${hue}`].find((s) => s.label === "500")!;
        // Signed shortest angular distance — so a pair straddling 0/360 compares correctly.
        const drift = Math.abs(((step.color.H - expected + 540) % 360) - 180);
        const where = `seed ${seedHue} / ${hue} (oog=${step.oog})`;
        if (step.oog) {
          expect(drift, where).toBeLessThan(MAX_MAPPED_HUE_DRIFT);
        } else {
          expect(drift, where).toBeLessThan(1e-6);
        }
      }
    }
  });

  it("an ACHROMATIC seed degenerates to seven identical greys — documented, not a crash", () => {
    // C=0 means every rotation lands on the same color. That is mathematically inevitable;
    // pin it so the behavior is a decision rather than a surprise, and confirm the graded
    // tokens still clear their floors in the degenerate case.
    for (const scheme of SCHEMES) {
      const { tokens } = resolveTheme("oklch(0.5 0 0)", scheme);
      const first = tokens[anchorName("analogous-a")];
      for (const hue of HARMONY_HUES) {
        expect(tokens[anchorName(hue)].C, `${scheme}/${hue}`).toBeCloseTo(
          first.C,
          6,
        );
        expect(tokens[anchorName(hue)].L, `${scheme}/${hue}`).toBeCloseTo(
          first.L,
          6,
        );
        expect(
          contrastWCAG(tokens[textName(hue)], tokens["surface-selected"]),
          `${scheme}/${hue} text`,
        ).toBeGreaterThanOrEqual(CONTRAST_TARGETS.accentText.wcag);
      }
    }
  });
});

describe("harmony blocks — the decorative anchor's identity claim", () => {
  // `binding.ts:186-188` calls the bare token "seed L (and chroma, gamut-mapped) at the
  // role's hue". That is true only up to two documented distortions: the ramp's EDGE clamp
  // (`ramp.ts:188-190` keeps the anchor strictly inside the scale) and the per-step gamut
  // map. Bound both, so the identity claim cannot quietly erode further.
  it("lands within 0.02 L of the seed for an ordinary in-gamut seed", () => {
    for (const seed of ["#3b82f6", "#eab308", "#06b6d4", "#7c3aed"])
      for (const scheme of SCHEMES) {
        const r = resolveTheme(seed, scheme);
        for (const hue of HARMONY_HUES) {
          expect(
            Math.abs(r.tokens[anchorName(hue)].L - r.seed.L),
            `${seed}/${scheme}/${hue}`,
          ).toBeLessThan(0.02);
        }
      }
  });

  it("is CLAMPED, not equal to the seed, at the lightness extremes", () => {
    // A near-white seed cannot be pinned exactly: the anchor is held strictly inside the
    // scale so both side-spans stay positive. The anchor therefore under-shoots — expected,
    // and shared with the accent ramp, but it means the bare token is NOT a literal
    // reproduction of an extreme seed.
    const white = resolveTheme("#ffffff", "light");
    expect(white.seed.L).toBeCloseTo(1, 3);
    for (const hue of HARMONY_HUES) {
      expect(white.tokens[anchorName(hue)].L, hue).toBeLessThan(white.seed.L);
      expect(white.tokens[anchorName(hue)].L, hue).toBeGreaterThan(0.9);
    }
  });

  it("resolves to the ramp step at the resolved anchorLabel, and reports it truthfully", () => {
    for (const seed of ["#3b82f6", "#ffffff", "#000000", "garbage"])
      for (const scheme of SCHEMES) {
        const r = resolveTheme(seed, scheme);
        for (const hue of HARMONY_HUES) {
          const step = r.ramps[`harmony-${hue}`].find(
            (s) => s.label === r.anchorLabel,
          );
          expect(step, `${String(seed)}/${scheme}/${hue}`).toBeDefined();
          expect(r.tokens[anchorName(hue)]).toEqual(step!.color);
          // The receipt names the ramp role and the label actually taken.
          expect(r.bindings[anchorName(hue)]).toEqual({
            kind: "step",
            role: `harmony-${hue}`,
            label: r.anchorLabel,
          });
        }
      }
  });
});

describe("harmony blocks — the refactor's equivalence claims", () => {
  it("the tier's ramp IS the token set's ramp, not a re-derived copy", () => {
    for (const seed of ["#3b82f6", "#ffffff", "garbage"])
      for (const scheme of SCHEMES) {
        const base = resolveTheme(seed, scheme);
        const tier = resolveHarmonyTier(seed, scheme);
        for (const hue of HARMONY_HUES) {
          expect(
            tier.hues[hue].ramp,
            `${String(seed)}/${scheme}/${hue}`,
          ).toEqual(base.ramps[`harmony-${hue}`]);
        }
      }
  });

  it(
    "reading the resolved theme yields the SAME picks the old independent solve did",
    () => {
      // The commit claims `resolveHarmonyTier` now reads `resolveTheme` with identical output.
      // Reconstruct the pre-refactor computation from its primitives and demand agreement —
      // if the anchor, the worst-case surface, or the chroma ever diverge between the two
      // paths, this is what catches it.
      for (const { label, seed } of SEEDS)
        for (const scheme of SCHEMES) {
          const base = resolveTheme(seed, scheme);
          const tier = resolveHarmonyTier(seed, scheme);
          const worstSurface = base.tokens["surface-selected"];
          const anchor = { label: base.anchorLabel, L: base.seed.L };
          for (const hue of HARMONY_HUES) {
            const ramp = buildRamp({
              hue: rotate(base.seed.H, HARMONY_HUE_ANGLES[hue].offset),
              chroma: base.seed.C,
              gamut: base.gamut,
              scheme,
              anchor,
            });
            const where = `${label}/${scheme}/${hue}`;
            expect(ramp, `${where} ramp`).toEqual(tier.hues[hue].ramp);
            const expectedText = minPass(
              ramp,
              worstSurface,
              CONTRAST_TARGETS.accentText,
            );
            const expectedFill = minPass(
              ramp,
              worstSurface,
              CONTRAST_TARGETS.ui,
            );
            expect(tier.hues[hue].text.color, `${where} text color`).toEqual(
              expectedText.color,
            );
            expect(
              tier.hues[hue].text.provenance.label,
              `${where} text label`,
            ).toBe(expectedText.label);
            expect(tier.hues[hue].fill.color, `${where} fill color`).toEqual(
              expectedFill.color,
            );
            expect(
              tier.hues[hue].fill.provenance.label,
              `${where} fill label`,
            ).toBe(expectedFill.label);
          }
        }
    },
    SWEEP_TIMEOUT,
  );

  it("the annex and the semantic surface tell the SAME provenance story in two vocabularies", () => {
    // `harmony-tier.ts:120-126` re-voices the binding provenance with the derived hue as the
    // role. The two must agree on the LABEL — that is the shared fact; only the role name
    // differs (`"analogous-a"` vs `"harmony-analogous-a"`).
    for (const seed of ["#3b82f6", "#eab308", "garbage"])
      for (const scheme of SCHEMES) {
        const base = resolveTheme(seed, scheme);
        const tier = resolveHarmonyTier(seed, scheme);
        for (const hue of HARMONY_HUES)
          for (const grade of ["text", "fill"] as const) {
            const binding =
              base.bindings[`harmony-${hue}-${grade}` as ThemeTokenName];
            const pick = tier.hues[hue][grade];
            const where = `${String(seed)}/${scheme}/${hue}-${grade}`;
            expect(binding?.kind, `${where} kind`).toBe("step");
            expect(pick.provenance.role, `${where} role`).toBe(hue);
            expect(pick.provenance.label, `${where} label`).toBe(
              binding?.kind === "step" ? binding.label : undefined,
            );
            expect(pick.color, `${where} color`).toEqual(
              base.tokens[`harmony-${hue}-${grade}` as ThemeTokenName],
            );
          }
      }
  });

  it("carries the relationship metadata for every derived hue", () => {
    const tier = resolveHarmonyTier("#3b82f6", "light");
    expect(Object.keys(tier.hues).sort()).toEqual([...HARMONY_HUES].sort());
    for (const hue of HARMONY_HUES) {
      expect(tier.hues[hue].hue, hue).toBe(hue);
      expect(tier.hues[hue].relationship, hue).toBe(
        HARMONY_HUE_ANGLES[hue].relationship,
      );
      expect(tier.hues[hue].offset, hue).toBe(HARMONY_HUE_ANGLES[hue].offset);
    }
  });
});

describe("harmony blocks — determinism", () => {
  it(
    "is byte-identical across repeated builds, for every seed and rule set",
    () => {
      for (const { label, seed } of SEEDS)
        for (const { label: ruleLabel, rules } of RULE_SETS) {
          const once = JSON.stringify(buildTokenSet(seed, { rules }));
          const twice = JSON.stringify(buildTokenSet(seed, { rules }));
          expect(twice, `${label}/${ruleLabel}`).toBe(once);
        }
    },
    SWEEP_TIMEOUT,
  );

  it("resolving one scheme does not depend on the other having been resolved", () => {
    // Ordering / hidden-state check: the harmony ramps are built per scheme from a shared
    // `direction` detected off the seed alone, so a cold dark-first resolve must match a
    // dark resolve that follows a light one.
    for (const { label, seed } of SEEDS) {
      const darkFirst = JSON.stringify(resolveTheme(seed, "dark").tokens);
      resolveTheme(seed, "light");
      const darkAfter = JSON.stringify(resolveTheme(seed, "dark").tokens);
      expect(darkAfter, label).toBe(darkFirst);
    }
  });
});
