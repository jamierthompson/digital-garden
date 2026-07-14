import { describe, expect, it } from "vitest";

import {
  buildHarmonyTier,
  resolveHarmonyTier,
  HARMONY_HUES,
  type HarmonyTier,
} from "./harmony-tier";
import {
  harmonyTierToCss,
  harmonyTierToTailwindTheme,
  harmonyTierToDesignTokens,
  tokenSetToTailwindTheme,
  tokenSetToDesignTokens,
} from "./export";
import { tokenSetToDeclarations, rampSetToDeclarations } from "./css";
import { formatOklch, parseColor } from "./convert";
import { buildTokenSet, resolveTheme } from "./palette";
import { CONTRAST_TARGETS } from "./targets";
import { checkContrast } from "./contrast";
import { inGamut } from "./gamut";
import { RAMP_LABELS, THEME_TOKEN_NAMES, RAMP_ROLES } from "./types";
import type { OkLCH } from "./types";

/** JND budget the gamut mapper is allowed to nudge L by (gamut.ts JND = 0.02 ΔEok). */
const JND = 0.02;

/** A spread of theme seeds that stress every branch: light-native, dark-native, achromatic,
 *  the L extremes, gamut-tight and wrap-edge hues, plus the unparseable fallback path. */
const SEEDS: Array<[label: string, seed: unknown]> = [
  ["mid blue", "#3b82f6"],
  ["rose", "#e11d48"],
  ["light lime (dark-native)", "oklch(0.9 0.18 130)"],
  ["dark violet (light-native)", "oklch(0.32 0.13 292)"],
  ["high-chroma green", "oklch(0.65 0.3 145)"],
  ["hue 0 edge", "oklch(0.6 0.15 0)"],
  ["hue 359 edge", "oklch(0.6 0.15 359)"],
  ["achromatic grey", "#808080"],
  ["near-white", "#fdfdfd"],
  ["near-black", "#050505"],
  ["fallback (garbage)", "not-a-color"],
];

/** Bake an OKLCH to the shipped literal's precision by round-tripping the REAL serializer
 *  (`formatOklch` → `parseColor`), so the "clears the floor as SHIPPED" checks measure what
 *  the browser actually paints and can never drift from the formatter's rounding. */
function bake(c: OkLCH): OkLCH {
  const baked = parseColor(formatOklch(c));
  if (!baked) throw new Error(`unbakeable literal: ${formatOklch(c)}`);
  return baked;
}

describe("harmony tier — structure & determinism (#152)", () => {
  it("exposes exactly the 7 derived hues, in canonical relationship order", () => {
    expect(HARMONY_HUES).toEqual([
      "analogous-a",
      "analogous-b",
      "complementary",
      "triadic-a",
      "triadic-b",
      "split-complementary-a",
      "split-complementary-b",
    ]);
  });

  it("resolves every hue with an 11-step ramp per scheme plus text + fill picks", () => {
    const tier = buildHarmonyTier("#3b82f6");
    expect(Object.keys(tier.hues).sort()).toEqual([...HARMONY_HUES].sort());
    for (const hue of HARMONY_HUES) {
      const h = tier.hues[hue];
      expect(h.hue).toBe(hue);
      expect(h.ramp.light).toHaveLength(RAMP_LABELS.length);
      expect(h.ramp.dark).toHaveLength(RAMP_LABELS.length);
      expect(h.ramp.light.map((s) => s.label)).toEqual([...RAMP_LABELS]);
      // The picks are shaped and tagged with this hue's provenance.
      for (const grade of ["text", "fill"] as const) {
        for (const scheme of ["light", "dark"] as const) {
          const pick = h[grade][scheme];
          expect(pick.provenance.kind).toBe("step");
          expect(pick.provenance.role).toBe(hue);
          expect(RAMP_LABELS).toContain(pick.provenance.label);
        }
      }
    }
  });

  it("is deterministic per gamut and independent of a default-opts call", () => {
    expect(buildHarmonyTier("#e11d48")).toEqual(buildHarmonyTier("#e11d48"));
    expect(buildHarmonyTier("#e11d48", { gamut: "p3" })).toEqual(
      buildHarmonyTier("#e11d48", { gamut: "p3" }),
    );
    expect(buildHarmonyTier("#e11d48", {})).toEqual(
      buildHarmonyTier("#e11d48"),
    );
  });

  it("reports the fallback flag and never throws on hostile input", () => {
    const hostile: unknown[] = [
      "garbage",
      "",
      null,
      undefined,
      42,
      {},
      NaN,
      Infinity,
      Symbol("x"),
      [255, 0, 0],
      () => "#fff",
      "hsl(200 50% 50%)",
      "oklch(0.5 0.1 NaN)",
    ];
    for (const bad of hostile) {
      let tier!: HarmonyTier;
      expect(() => (tier = buildHarmonyTier(bad))).not.toThrow();
      expect(tier.meta.isFallback).toBe(true);
      // Still fully shaped and in gamut.
      for (const hue of HARMONY_HUES) {
        for (const step of tier.hues[hue].ramp.light) {
          expect(inGamut(step.color, "srgb")).toBe(true);
        }
      }
    }
    expect(buildHarmonyTier("#3b82f6").meta.isFallback).toBe(false);
  });

  it("never throws on an explicitly-null opts (QA-102 posture)", () => {
    expect(() =>
      buildHarmonyTier("#3b82f6", null as unknown as undefined),
    ).not.toThrow();
    expect(buildHarmonyTier("#3b82f6", null as unknown as undefined)).toEqual(
      buildHarmonyTier("#3b82f6"),
    );
  });
});

describe("harmony tier — ramps get the accent treatment", () => {
  it.each(SEEDS)(
    "%s: every step gamut-mapped, monotonic, oog flagged",
    (_l, seed) => {
      for (const gamut of ["srgb", "p3"] as const) {
        const tier = buildHarmonyTier(seed, { gamut });
        for (const hue of HARMONY_HUES) {
          for (const scheme of ["light", "dark"] as const) {
            const ramp = tier.hues[hue].ramp[scheme];
            let prevL = Infinity;
            for (const step of ramp) {
              expect(inGamut(step.color, gamut)).toBe(true);
              expect(typeof step.oog).toBe("boolean");
              // 50 → 950 is lightest → darkest, strictly descending L.
              expect(step.color.L).toBeLessThanOrEqual(prevL + 1e-9);
              prevL = step.color.L;
            }
          }
        }
      }
    },
  );

  it.each(SEEDS)(
    "%s: harmony ramp shares the accent ramp's anchored lightness profile (within JND)",
    (_l, seed) => {
      for (const scheme of ["light", "dark"] as const) {
        const accentRamp = resolveTheme(seed, scheme).ramps.accent;
        const tier = resolveHarmonyTier(seed, scheme);
        for (const hue of HARMONY_HUES) {
          const ramp = tier.hues[hue].ramp;
          // Same scale + same anchor + same rules → identical NOMINAL L. Only the per-hue
          // gamut clip differs, and it can nudge each side up to one JND from that shared
          // nominal — so accent vs. harmony differ by at most 2×JND (they clip independently).
          for (let i = 0; i < ramp.length; i++) {
            expect(
              Math.abs(ramp[i].color.L - accentRamp[i].color.L),
            ).toBeLessThan(2 * JND);
          }
        }
      }
    },
  );

  it.each(SEEDS)(
    "%s: at least one step lands at the seed's own lightness (anchored, #108)",
    (_l, seed) => {
      for (const scheme of ["light", "dark"] as const) {
        const tier = resolveHarmonyTier(seed, scheme);
        const seedL = tier.seed.L;
        for (const hue of HARMONY_HUES) {
          const nearest = Math.min(
            ...tier.hues[hue].ramp.map((s) => Math.abs(s.color.L - seedL)),
          );
          // The anchor pins a step to seed.L (clamped just inside the scale for the L
          // extremes, so near-white/near-black seeds land close, not exact).
          expect(nearest).toBeLessThan(0.06);
        }
      }
    },
  );

  it("holds the seed's dark-scheme chroma dampening (0.82) — dark seed.C ≤ light seed.C", () => {
    for (const [, seed] of SEEDS) {
      const light = resolveHarmonyTier(seed, "light").seed;
      const dark = resolveHarmonyTier(seed, "dark").seed;
      // Dark dampens the seed chroma (then both gamut-map); never richer than light.
      expect(dark.C).toBeLessThanOrEqual(light.C + 1e-9);
    }
  });
});

describe("harmony tier — receipt-grade picks clear their targets as shipped", () => {
  it.each(SEEDS)(
    "%s: text pick clears accentText, fill pick clears ui, vs the worst-case surface (both schemes, both gamuts, after 4-dp bake)",
    (_l, seed) => {
      for (const gamut of ["srgb", "p3"] as const) {
        for (const scheme of ["light", "dark"] as const) {
          const base = resolveTheme(seed, scheme, { gamut });
          const worstSurface = bake(base.tokens["surface-selected"]);
          const tier = resolveHarmonyTier(seed, scheme, { gamut });
          for (const hue of HARMONY_HUES) {
            const h = tier.hues[hue];
            const text = checkContrast(
              bake(h.text.color),
              worstSurface,
              CONTRAST_TARGETS.accentText,
            );
            const fill = checkContrast(
              bake(h.fill.color),
              worstSurface,
              CONTRAST_TARGETS.ui,
            );
            expect(
              text.passes,
              `${hue} text ${scheme}/${gamut}: wcag ${text.wcag} apca ${text.apca}`,
            ).toBe(true);
            expect(
              fill.passes,
              `${hue} fill ${scheme}/${gamut}: wcag ${fill.wcag} apca ${fill.apca}`,
            ).toBe(true);
          }
        }
      }
    },
  );

  it("each pick's color IS its provenance step's color (solve-time, not value-matched)", () => {
    for (const [, seed] of SEEDS) {
      for (const scheme of ["light", "dark"] as const) {
        const tier = resolveHarmonyTier(seed, scheme);
        for (const hue of HARMONY_HUES) {
          const h = tier.hues[hue];
          for (const pick of [h.text, h.fill]) {
            const step = h.ramp.find((s) => s.label === pick.provenance.label);
            expect(step).toBeDefined();
            expect(pick.color).toEqual(step!.color);
          }
        }
      }
    }
  });
});

/** Every custom property a serializer emits, as `--name` (no value). */
function props(css: string): string[] {
  return [...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
}

describe("harmony tier — opt-in, separated export group", () => {
  const tier = buildHarmonyTier("#3b82f6");

  it("Tailwind @theme emits the harmony group under --color-harmony-*", () => {
    const theme = harmonyTierToTailwindTheme(tier);
    expect(theme.startsWith("@theme {")).toBe(true);
    const names = props(theme);
    // 7 hues × (11 ramp steps + text + fill) = 91 custom properties, all harmony-namespaced.
    expect(names).toHaveLength(HARMONY_HUES.length * (RAMP_LABELS.length + 2));
    expect(names.every((n) => n.startsWith("--color-harmony-"))).toBe(true);
    expect(names).toContain("--color-harmony-analogous-a-500");
    expect(names).toContain("--color-harmony-complementary-text");
    expect(names).toContain("--color-harmony-split-complementary-b-fill");
    expect(theme).toContain("light-dark(");
  });

  it("CSS emits bare --harmony-* under the given selector (default :root)", () => {
    const css = harmonyTierToCss(tier);
    expect(css.startsWith(":root {")).toBe(true);
    const scoped = harmonyTierToCss(tier, '[data-entry="x"]');
    expect(scoped.startsWith('[data-entry="x"] {')).toBe(true);
    const names = props(css);
    expect(names.every((n) => n.startsWith("--harmony-"))).toBe(true);
    expect(names).toContain("--harmony-triadic-b-500");
  });

  it("does NOT emit any semantic-token or core-ramp-role name (contract untouched)", () => {
    const emitted = [
      ...props(harmonyTierToCss(tier)),
      ...props(harmonyTierToTailwindTheme(tier)),
    ];
    for (const name of THEME_TOKEN_NAMES) {
      expect(emitted).not.toContain(`--${name}`);
      expect(emitted).not.toContain(`--color-${name}`);
    }
    // No `--accent-500` / `--neutral-200` / status ramp props leak into the annex.
    for (const role of RAMP_ROLES) {
      expect(emitted.some((n) => n.startsWith(`--harmony-${role}-`))).toBe(
        false,
      );
    }
  });

  it("DTCG emits a per-scheme `harmony` group with ramp + text + fill, DTCG object form", () => {
    const dt = harmonyTierToDesignTokens(tier);
    for (const scheme of ["light", "dark"] as const) {
      expect(Object.keys(dt[scheme])).toEqual(["harmony"]);
      expect(Object.keys(dt[scheme].harmony).sort()).toEqual(
        [...HARMONY_HUES].sort(),
      );
      for (const hue of HARMONY_HUES) {
        const group = dt[scheme].harmony[hue];
        expect(Object.keys(group.ramp)).toEqual([...RAMP_LABELS]);
        for (const token of [
          group.text,
          group.fill,
          ...Object.values(group.ramp),
        ]) {
          expect(token.$type).toBe("color");
          expect(token.$value.colorSpace).toBe("oklch");
          expect(token.$value.hex).toMatch(/^#[0-9a-f]{6}$/);
          expect(token.$value.components).toHaveLength(3);
        }
      }
    }
  });

  it("honors the sRGB serialization format across all three serializers", () => {
    const hexTheme = harmonyTierToTailwindTheme(tier, { format: "hex" });
    expect(hexTheme).toMatch(/#[0-9a-f]{6}/);
    expect(hexTheme).not.toContain("oklch(");
    const dt = harmonyTierToDesignTokens(tier, { format: "rgb" });
    expect(dt.light.harmony["analogous-a"].text.$value.colorSpace).toBe("srgb");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fresh adversarial QA (#152). Attacks the edges the author's happy path optimized
// past: the "worst-case surface" promise measured on EVERY surface, the DTCG hex
// fallback under a P3 gamut, provenance truthfulness when 7 hues collapse to one
// ramp, the 0.4-chroma boundary, finiteness of every emitted color, and the
// dual-scheme zip's meta correctness. Every color is baked to the shipped 4/4/2-dp
// literal before it is measured — the check is on what the browser actually paints.
// ─────────────────────────────────────────────────────────────────────────────

/** The five surface tokens a harmony pick can sit on (#160's full band, state surfaces
 *  included); `surface-selected` is the derivation's declared worst case, so a pick that
 *  clears it must also clear the other four. */
const SURFACE_TOKENS = [
  "background",
  "surface",
  "surface-elevated",
  "surface-hover",
  "surface-selected",
] as const;

/** True when every OKLCH component is a finite number (no NaN/Infinity leak). */
function allFinite(c: OkLCH): boolean {
  return Number.isFinite(c.L) && Number.isFinite(c.C) && Number.isFinite(c.H);
}

describe("QA — adversarial (#152)", () => {
  it.each(SEEDS)(
    "%s: each pick clears its target on EVERY surface, not just surface-selected (both schemes/gamuts, baked)",
    (_l, seed) => {
      for (const gamut of ["srgb", "p3"] as const) {
        for (const scheme of ["light", "dark"] as const) {
          const base = resolveTheme(seed, scheme, { gamut });
          const tier = resolveHarmonyTier(seed, scheme, { gamut });
          for (const surfaceName of SURFACE_TOKENS) {
            const surface = bake(base.tokens[surfaceName]);
            for (const hue of HARMONY_HUES) {
              const h = tier.hues[hue];
              const text = checkContrast(
                bake(h.text.color),
                surface,
                CONTRAST_TARGETS.accentText,
              );
              const fill = checkContrast(
                bake(h.fill.color),
                surface,
                CONTRAST_TARGETS.ui,
              );
              expect(
                text.passes,
                `${hue} text ${scheme}/${gamut} vs ${surfaceName}: wcag ${text.wcag} apca ${text.apca}`,
              ).toBe(true);
              expect(
                fill.passes,
                `${hue} fill ${scheme}/${gamut} vs ${surfaceName}: wcag ${fill.wcag} apca ${fill.apca}`,
              ).toBe(true);
            }
          }
        }
      }
    },
  );

  it.each(SEEDS)(
    "%s: no emitted color carries a non-finite component (ramp steps + both picks, both schemes/gamuts)",
    (_l, seed) => {
      for (const gamut of ["srgb", "p3"] as const) {
        const tier = buildHarmonyTier(seed, { gamut });
        for (const hue of HARMONY_HUES) {
          const h = tier.hues[hue];
          for (const scheme of ["light", "dark"] as const) {
            for (const step of h.ramp[scheme]) {
              expect(
                allFinite(step.color),
                `${hue} ${scheme} ${step.label}`,
              ).toBe(true);
              expect(inGamut(step.color, gamut)).toBe(true);
            }
            expect(allFinite(h.text[scheme].color)).toBe(true);
            expect(allFinite(h.fill[scheme].color)).toBe(true);
          }
        }
      }
    },
  );

  it.each(["srgb", "p3"] as const)(
    "DTCG hex fallback is a 6-digit lowercase hex under the %s gamut, across all formats",
    (gamut) => {
      const tier = buildHarmonyTier("oklch(0.65 0.3 145)", { gamut });
      for (const format of ["oklch", "hex", "rgb"] as const) {
        const dt = harmonyTierToDesignTokens(tier, { format });
        for (const scheme of ["light", "dark"] as const) {
          for (const hue of HARMONY_HUES) {
            const group = dt[scheme].harmony[hue];
            for (const token of [
              group.text,
              group.fill,
              ...Object.values(group.ramp),
            ]) {
              // The sRGB hex fallback must ALWAYS be present and valid, even when the
              // color itself is a P3 value the hex clamps down from (never overflow).
              expect(token.$value.hex).toMatch(/^#[0-9a-f]{6}$/);
              const [r, g, b] = token.$value.components;
              for (const ch of [r, g, b])
                expect(Number.isFinite(ch)).toBe(true);
            }
          }
        }
      }
    },
  );

  it.each(["srgb", "p3"] as const)(
    "serialized CSS/Tailwind never emits NaN/Infinity/undefined under the %s gamut",
    (gamut) => {
      const tier = buildHarmonyTier("oklch(0.65 0.3 145)", { gamut });
      for (const css of [
        harmonyTierToCss(tier),
        harmonyTierToTailwindTheme(tier),
        harmonyTierToCss(tier, ":root", { format: "hex" }),
        harmonyTierToTailwindTheme(tier, { format: "rgb" }),
      ]) {
        expect(css).not.toMatch(/NaN|Infinity|undefined|null/);
      }
    },
  );

  it("achromatic seed: provenance stays truthful when the 7 hues visually collapse to grey", () => {
    // A near-grey seed (C≈0) makes every derived hue's ramp visually identical — same L
    // profile, chroma indistinguishable from zero — so value-matching on the painted color
    // would be ambiguous across hues. Solve-time provenance must still name THIS hue and a
    // real step of ITS OWN ramp. (The OKLCH objects keep a distinct H field, but that is not
    // what a receipt reader compares — the paint is grey.)
    for (const scheme of ["light", "dark"] as const) {
      const tier = resolveHarmonyTier("#808080", scheme);
      const refL = tier.hues["analogous-a"].ramp.map((s) => s.color.L);
      for (const hue of HARMONY_HUES) {
        const h = tier.hues[hue];
        // Visual collapse is real: same L profile, chroma ≈ 0 at every step.
        expect(h.ramp.map((s) => s.color.L)).toEqual(refL);
        for (const step of h.ramp) expect(step.color.C).toBeLessThan(1e-4);
        // Provenance is nonetheless per-hue truthful, landed at solve time.
        for (const pick of [h.text, h.fill]) {
          expect(pick.provenance.role).toBe(hue);
          const step = h.ramp.find((s) => s.label === pick.provenance.label);
          expect(
            step,
            `${hue} ${pick.provenance.label} not on its own ramp`,
          ).toBeDefined();
          expect(pick.color).toEqual(step!.color);
        }
      }
    }
  });

  it("extreme chroma (0.4) never throws, stays in gamut, and clears every pick", () => {
    for (const gamut of ["srgb", "p3"] as const) {
      let tier!: HarmonyTier;
      expect(
        () => (tier = buildHarmonyTier("oklch(0.6 0.4 300)", { gamut })),
      ).not.toThrow();
      for (const scheme of ["light", "dark"] as const) {
        const base = resolveTheme("oklch(0.6 0.4 300)", scheme, { gamut });
        const worstSurface = bake(base.tokens["surface-selected"]);
        for (const hue of HARMONY_HUES) {
          const h = tier.hues[hue];
          for (const step of h.ramp[scheme]) {
            expect(inGamut(step.color, gamut)).toBe(true);
          }
          expect(
            checkContrast(
              bake(h.text[scheme].color),
              worstSurface,
              CONTRAST_TARGETS.accentText,
            ).passes,
          ).toBe(true);
          expect(
            checkContrast(
              bake(h.fill[scheme].color),
              worstSurface,
              CONTRAST_TARGETS.ui,
            ).passes,
          ).toBe(true);
        }
      }
    }
  });

  it("buildHarmonyTier zips the correct per-scheme seed, gamut, and fallback flag", () => {
    for (const [, seed] of SEEDS) {
      for (const gamut of ["srgb", "p3"] as const) {
        const tier = buildHarmonyTier(seed, { gamut });
        const light = resolveHarmonyTier(seed, "light", { gamut });
        const dark = resolveHarmonyTier(seed, "dark", { gamut });
        expect(tier.meta.seed.light).toEqual(light.seed);
        expect(tier.meta.seed.dark).toEqual(dark.seed);
        expect(tier.meta.gamut).toBe(gamut);
        // The fallback verdict is a property of the input alone — both schemes must agree,
        // so the single flag `buildHarmonyTier` reports off `light` is not a half-truth.
        expect(light.isFallback).toBe(dark.isFallback);
        expect(tier.meta.isFallback).toBe(light.isFallback);
        // Each zipped hue carries the matching per-scheme picks (no light/dark crossover).
        for (const hue of HARMONY_HUES) {
          expect(tier.hues[hue].text.light).toEqual(light.hues[hue].text);
          expect(tier.hues[hue].text.dark).toEqual(dark.hues[hue].text);
          expect(tier.hues[hue].fill.light).toEqual(light.hues[hue].fill);
          expect(tier.hues[hue].fill.dark).toEqual(dark.hues[hue].fill);
        }
      }
    }
  });

  it("hue wraparound (0° and 359°) rotates cleanly — no NaN, deterministic, complementary is ~180° off", () => {
    for (const seed of ["oklch(0.6 0.15 0)", "oklch(0.6 0.15 359.9)"]) {
      const a = buildHarmonyTier(seed);
      const b = buildHarmonyTier(seed);
      expect(a).toEqual(b); // determinism across the wrap boundary
      // The offset metadata is the rotation contract: complementary sits 180° from the seed.
      expect(a.hues.complementary.offset).toBe(180);
      expect(a.hues["analogous-a"].offset).toBe(-30);
      expect(a.hues["split-complementary-b"].offset).toBe(210);
    }
  });

  it("partial/garbage opts fields degrade to defaults without throwing", () => {
    const cases: unknown[] = [
      { gamut: undefined },
      { rules: undefined },
      { gamut: "p3", rules: undefined },
      { gamut: "srgb", rules: {} },
      {},
    ];
    for (const opts of cases) {
      expect(() =>
        buildHarmonyTier(
          "#3b82f6",
          opts as Parameters<typeof buildHarmonyTier>[1],
        ),
      ).not.toThrow();
    }
    // A bare/undefined-gamut opts resolves identically to the srgb default.
    expect(
      buildHarmonyTier("#3b82f6", { gamut: undefined } as Parameters<
        typeof buildHarmonyTier
      >[1]),
    ).toEqual(buildHarmonyTier("#3b82f6"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fresh-eyes adversarial QA (second pass, #152 × #160) — the seams the suite above
// doesn't reach: the generative-rules interaction with the picks, DIRECT per-scheme
// scale evidence (not seed-relative), the alpha × harmony export seam, opt-in purity
// of the core serializers, and byte-level exporter determinism.
// ─────────────────────────────────────────────────────────────────────────────

describe("QA — fresh-eyes adversarial: rules × picks (#101 interaction)", () => {
  // The suite above never varies EngineRules against the pick floors. A distribution
  // reshapes the text-zone interior the picks land in; chroma/hue policies move every
  // candidate step — the picks must re-solve and still clear on the worst-case surface
  // under EVERY policy combination (the same guarantee rules.test.ts pins for the 37
  // semantic tokens).
  it("text + fill picks clear their floors under every rules combination (both schemes)", () => {
    const distributions = [
      "tailwind",
      "linear",
      "eased",
      "punchy",
      "soft",
    ] as const;
    const chromaPolicies = ["flat", "taper", "hold"] as const;
    const huePolicies = [
      "constant",
      "warm-shadows",
      "cool-highlights",
    ] as const;
    for (const distribution of distributions)
      for (const chromaPolicy of chromaPolicies)
        for (const huePolicy of huePolicies)
          for (const tintedNeutrals of [true, false])
            for (const scheme of ["light", "dark"] as const) {
              const rules = {
                distribution,
                chromaPolicy,
                huePolicy,
                tintedNeutrals,
              };
              const base = resolveTheme("#3b82f6", scheme, { rules });
              const worstSurface = bake(base.tokens["surface-selected"]);
              const tier = resolveHarmonyTier("#3b82f6", scheme, { rules });
              for (const hue of HARMONY_HUES) {
                const h = tier.hues[hue];
                const where = `${hue} ${scheme} ${distribution}/${chromaPolicy}/${huePolicy}/tinted:${tintedNeutrals}`;
                expect(
                  checkContrast(
                    bake(h.text.color),
                    worstSurface,
                    CONTRAST_TARGETS.accentText,
                  ).passes,
                  `text ${where}`,
                ).toBe(true);
                expect(
                  checkContrast(
                    bake(h.fill.color),
                    worstSurface,
                    CONTRAST_TARGETS.ui,
                  ).passes,
                  `fill ${where}`,
                ).toBe(true);
              }
            }
  }, 60_000);
});

describe("QA — fresh-eyes adversarial: per-scheme scale, proven directly (#160)", () => {
  // The "shares the accent ramp's profile" test above is RELATIVE — if accent and harmony
  // were both label-flipped, it would still pass. Pin the scales ABSOLUTELY: the anchor
  // bend preserves the ramp endpoints and the gamut map may nudge L by at most one JND,
  // so each scheme's harmony ramps must end at ITS OWN scale extremes (light 950 → 0.145,
  // dark 950 → 0.165, dark 50 → 0.985 — ramp.ts RAMP_L), and dark must not be a flip.
  it("harmony ramps carry each scheme's own endpoint lightness (not a mirror flip)", () => {
    const tier = buildHarmonyTier("#3b82f6");
    for (const hue of HARMONY_HUES) {
      const light = tier.hues[hue].ramp.light;
      const dark = tier.hues[hue].ramp.dark;
      expect(
        Math.abs(light[10].color.L - 0.145),
        `${hue} light 950`,
      ).toBeLessThan(JND);
      expect(
        Math.abs(dark[10].color.L - 0.165),
        `${hue} dark 950`,
      ).toBeLessThan(JND);
      expect(Math.abs(dark[0].color.L - 0.985), `${hue} dark 50`).toBeLessThan(
        JND,
      );
      expect(dark.map((s) => s.color.L)).not.toEqual(
        [...light.map((s) => s.color.L)].reverse(),
      );
    }
  });
});

describe("QA — fresh-eyes adversarial: export seams (#152 × scrim-alpha #160)", () => {
  const tier = buildHarmonyTier("#3b82f6");

  it("no harmony token ever carries a DTCG alpha field (opaque tier, shared builder)", () => {
    // The DTCG builder is shared with the semantic export, whose scrim DOES carry alpha —
    // the seam must not leak it into the (all-opaque) harmony annex.
    for (const format of ["oklch", "hex", "rgb"] as const) {
      const dt = harmonyTierToDesignTokens(tier, { format });
      for (const scheme of ["light", "dark"] as const)
        for (const hue of HARMONY_HUES) {
          const group = dt[scheme].harmony[hue];
          for (const token of [
            group.text,
            group.fill,
            ...Object.values(group.ramp),
          ]) {
            expect("alpha" in token.$value, `${hue}/${scheme}/${format}`).toBe(
              false,
            );
          }
        }
    }
  });

  it("the CORE serializers emit no harmony output — the tier is opt-in by construction", () => {
    // The reverse direction (harmony emits no semantic names) is pinned above; this pins
    // that opting OUT costs nothing: the guarded tokenSetTo* surfaces never mention the tier.
    const set = buildTokenSet("#3b82f6");
    expect(tokenSetToDeclarations(set)).not.toContain("harmony");
    expect(rampSetToDeclarations(set)).not.toContain("harmony");
    expect(tokenSetToTailwindTheme(set)).not.toContain("harmony");
    expect(JSON.stringify(tokenSetToDesignTokens(set))).not.toContain(
      "harmony",
    );
  });

  it("harmony exporters are byte-deterministic across independent builds", () => {
    const again = buildHarmonyTier("#3b82f6");
    expect(harmonyTierToCss(again)).toBe(harmonyTierToCss(tier));
    expect(harmonyTierToTailwindTheme(again)).toBe(
      harmonyTierToTailwindTheme(tier),
    );
    expect(JSON.stringify(harmonyTierToDesignTokens(again))).toBe(
      JSON.stringify(harmonyTierToDesignTokens(tier)),
    );
  });

  it("harmony DTCG is plain JSON (survives a stringify round-trip)", () => {
    const dt = harmonyTierToDesignTokens(tier);
    expect(JSON.parse(JSON.stringify(dt))).toEqual(dt);
  });
});

describe("QA — fresh-eyes adversarial: exotic hostile inputs (#152)", () => {
  it("non-primitive and pathological inputs fall back without throwing", () => {
    const inputs: unknown[] = [
      new String("#ff0000"), // a String OBJECT is not a string primitive
      { toString: () => "#ff0000" },
      "a".repeat(100_000),
      true,
      -0,
    ];
    for (const input of inputs) {
      const t = buildHarmonyTier(input);
      expect(t.meta.isFallback).toBe(true);
      for (const hue of HARMONY_HUES)
        expect(inGamut(t.hues[hue].text.light.color, "srgb")).toBe(true);
    }
  });
});
