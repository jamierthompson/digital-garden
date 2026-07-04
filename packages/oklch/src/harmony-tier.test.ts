import { describe, expect, it } from "vitest";

import {
  buildHarmonyTier,
  resolveHarmonyTier,
  HARMONY_HUES,
  type HarmonyHue,
  type HarmonyTier,
} from "./harmony-tier";
import {
  harmonyTierToCss,
  harmonyTierToTailwindTheme,
  harmonyTierToDesignTokens,
} from "./export";
import { resolveTheme } from "./palette";
import { CONTRAST_TARGETS } from "./targets";
import { checkContrast } from "./contrast";
import { inGamut } from "./gamut";
import { RAMP_LABELS, BRAND_TOKEN_NAMES, RAMP_ROLES } from "./types";
import type { Gamut, OkLCH, Scheme } from "./types";

/** JND budget the gamut mapper is allowed to nudge L by (gamut.ts JND = 0.02 ΔEok). */
const JND = 0.02;

/** A spread of brand seeds that stress every branch: light-native, dark-native, achromatic,
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

/** Bake an OKLCH to the shipped literal's precision (formatOklch: 4/4/2 dp), so the
 *  "clears the floor as SHIPPED" checks measure what the browser actually paints. */
function bake(c: OkLCH): OkLCH {
  const r = (n: number, p: number): number =>
    Number.isFinite(n) ? parseFloat(n.toFixed(p)) : 0;
  return { L: r(c.L, 4), C: r(c.C, 4), H: r(c.H, 2) };
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

describe("harmony tier — ramps get the brand treatment", () => {
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
    "%s: harmony ramp shares the brand ramp's anchored lightness profile (within JND)",
    (_l, seed) => {
      for (const scheme of ["light", "dark"] as const) {
        const brand = resolveTheme(seed, scheme).ramps.brand;
        const tier = resolveHarmonyTier(seed, scheme);
        for (const hue of HARMONY_HUES) {
          const ramp = tier.hues[hue].ramp;
          // Same scale + same anchor + same rules → identical NOMINAL L. Only the per-hue
          // gamut clip differs, and it can nudge each side up to one JND from that shared
          // nominal — so brand vs. harmony differ by at most 2×JND (they clip independently).
          for (let i = 0; i < ramp.length; i++) {
            expect(Math.abs(ramp[i].color.L - brand[i].color.L)).toBeLessThan(
              2 * JND,
            );
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
          const surface2 = bake(base.tokens["surface-2"]);
          const tier = resolveHarmonyTier(seed, scheme, { gamut });
          for (const hue of HARMONY_HUES) {
            const h = tier.hues[hue];
            const text = checkContrast(
              bake(h.text.color),
              surface2,
              CONTRAST_TARGETS.accentText,
            );
            const fill = checkContrast(
              bake(h.fill.color),
              surface2,
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
    for (const name of BRAND_TOKEN_NAMES) {
      expect(emitted).not.toContain(`--${name}`);
      expect(emitted).not.toContain(`--color-${name}`);
    }
    // No `--brand-500` / `--neutral-200` / status ramp props leak into the annex.
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
