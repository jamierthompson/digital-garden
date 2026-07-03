import { describe, expect, it } from "vitest";

import { buildHarmonyPalette, HARMONY_KINDS } from "./harmony";
import type { HarmonyPalette } from "./harmony";
import { parseColor } from "./convert";
import { inGamut } from "./gamut";
import { checkContrast } from "./contrast";

/** JND budget the mapper is allowed to nudge L by (gamut.ts JND = 0.02 ΔEok). */
const JND = 0.02;

/** Every derived color across every relationship, flat. */
function everyColor(palette: HarmonyPalette) {
  return HARMONY_KINDS.flatMap((kind) => palette[kind]);
}

/** Angular distance on the hue circle (0–180). */
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe("buildHarmonyPalette (#102)", () => {
  const SEED_HUES = [5, 60, 145, 200, 262, 350]; // incl. both wrap edges

  it.each(SEED_HUES)("rotates the documented angles from seed hue %i", (H) => {
    // Chroma 0.04 at L 0.6 is inside sRGB at every hue, so the mapper is the identity
    // and the NOMINAL rotation survives to the output exactly.
    const palette = buildHarmonyPalette(`oklch(0.6 0.04 ${H})`);
    const seedH = palette.seed.H;
    const expectAngles = (kind: keyof typeof palette, deltas: number[]) => {
      const set = palette[kind] as { H: number }[];
      expect(set).toHaveLength(deltas.length);
      for (let i = 0; i < deltas.length; i++) {
        expect(
          hueDist(set[i].H, (((seedH + deltas[i]) % 360) + 360) % 360),
          `${String(kind)}[${i}] from hue ${H}`,
        ).toBeLessThan(1e-9);
      }
    };
    expectAngles("analogous", [-30, 30]);
    expectAngles("complementary", [180]);
    expectAngles("triadic", [-120, 120]);
    expectAngles("split-complementary", [150, 210]);
  });

  it("normalizes every derived hue into [0, 360) across the wrap", () => {
    for (const H of SEED_HUES) {
      const palette = buildHarmonyPalette(`oklch(0.6 0.12 ${H})`);
      for (const kind of HARMONY_KINDS) {
        for (const color of palette[kind]) {
          expect(color.H).toBeGreaterThanOrEqual(0);
          expect(color.H).toBeLessThan(360);
        }
      }
    }
  });

  it("holds the seed's lightness (± the mapper's clip nudge) and gamut-maps every color", () => {
    // A saturated seed whose rotations cross gamut-tight hue regions: the CSS4 mapper
    // trims chroma at ~constant L, but accepts a sub-JND clip at the boundary
    // (gamut.ts JND = 0.02 ΔEok) — so family coherence is bounded by the mapper's own
    // imperceptibility budget, not bit-equality.
    const palette = buildHarmonyPalette("oklch(0.65 0.25 30)");
    for (const kind of HARMONY_KINDS) {
      for (const color of palette[kind]) {
        expect(Math.abs(color.L - palette.seed.L)).toBeLessThan(0.02);
        expect(inGamut(color, "srgb")).toBe(true);
      }
    }
  });

  it("maps into P3 when asked", () => {
    const palette = buildHarmonyPalette("oklch(0.65 0.28 145)", {
      gamut: "p3",
    });
    for (const kind of HARMONY_KINDS) {
      for (const color of palette[kind]) {
        expect(inGamut(color, "p3")).toBe(true);
      }
    }
  });

  it("falls back defensively on unparseable input, never throws", () => {
    for (const bad of ["garbage", "", null, undefined, 42, {}]) {
      const palette = buildHarmonyPalette(bad);
      expect(palette.isFallback).toBe(true);
      expect(palette.complementary).toHaveLength(1);
    }
    const good = buildHarmonyPalette("#3b82f6");
    expect(good.isFallback).toBe(false);
  });

  it("is deterministic", () => {
    expect(buildHarmonyPalette("#e11d48")).toEqual(
      buildHarmonyPalette("#e11d48"),
    );
  });

  it("is decorative — but composes with checkContrast when a color must back text", () => {
    // The documented consumer pattern: harmony colors carry no contrast guarantee;
    // a consumer that puts text on one checks it explicitly (#100).
    const palette = buildHarmonyPalette("#3b82f6");
    const [comp] = palette.complementary;
    const label = parseColor("#ffffff")!;
    const check = checkContrast(label, comp, { wcag: 4.5, apca: 60 });
    expect(typeof check.passes).toBe("boolean"); // no guarantee either way — measured, not promised
    expect(check.wcag).toBeGreaterThan(1);
  });
});

describe("buildHarmonyPalette — QA-102 edge hardening", () => {
  // ── Achromatic and extreme-L seeds: rotating an undefined/irrelevant hue ──
  // OKLCH hue is meaningless at C=0, so every rotation lands on the SAME grey.
  // The set must stay achromatic, hold L exactly, and stay in gamut — the
  // family reads as one flat swatch, which is the sane (if visually dull) answer.
  it.each(["#808080", "oklch(0.5 0 0)", "rgb(128 128 128)"])(
    "grey seed %s yields an all-achromatic, single-L family",
    (grey) => {
      const palette = buildHarmonyPalette(grey);
      expect(palette.isFallback).toBe(false);
      for (const color of everyColor(palette)) {
        expect(color.C).toBeLessThan(1e-6); // stays grey — no phantom chroma
        expect(color.L).toBeCloseTo(palette.seed.L, 10); // L held exactly
        expect(inGamut(color, "srgb")).toBe(true);
      }
    },
  );

  it.each([
    ["white", "#ffffff", 1],
    ["black", "#000000", 0],
  ])("%s seed collapses to a single achromatic point", (_name, hex, L) => {
    // The hand-rolled sRGB⇄OKLab round-trip lands ~6.5e-9 off exact L=1 for
    // white, so the tolerance is float-drift, not JND — the point is the family
    // collapses to one flat, achromatic swatch at the extreme L.
    const palette = buildHarmonyPalette(hex);
    expect(palette.isFallback).toBe(false);
    expect(palette.seed.L).toBeCloseTo(L, 6);
    for (const color of everyColor(palette)) {
      expect(color.C).toBeLessThan(1e-6);
      expect(color.L).toBeCloseTo(palette.seed.L, 10); // whole family shares one L
      expect(inGamut(color, "srgb")).toBe(true);
    }
  });

  // ── The L-holding claim, pinned across a dense grid (not one seed) ──
  // harmony.ts promises every derived color keeps the seed's L, tolerating only
  // the mapper's sub-JND clip nudge. Prove that bound holds everywhere, in both
  // gamuts — a regression guard so a future mapper change that breaks family
  // coherence trips here instead of shipping.
  it("holds seed L within one JND, and stays in gamut, across a dense grid", () => {
    let worstDrift = 0;
    for (const gamut of ["srgb", "p3"] as const) {
      for (let L = 0.1; L <= 0.9; L += 0.1) {
        for (let C = 0.05; C <= 0.4; C += 0.05) {
          for (let H = 0; H < 360; H += 15) {
            const palette = buildHarmonyPalette(`oklch(${L} ${C} ${H})`, {
              gamut,
            });
            for (const color of everyColor(palette)) {
              const drift = Math.abs(color.L - palette.seed.L);
              worstDrift = Math.max(worstDrift, drift);
              expect(inGamut(color, gamut)).toBe(true);
            }
          }
        }
      }
    }
    // The whole grid stays under the JND budget the family-coherence claim rests on.
    expect(worstDrift).toBeLessThan(JND);
  });

  // ── P3 preserves at least as much chroma as sRGB (the wide-gamut claim) ──
  // NOTE the claim is NOT per-position: each gamut trims the SEED's chroma
  // differently first, so rotations chain off a different base and a single P3
  // color can land marginally *below* its sRGB twin (seen at oklch(0.5 0.37 328)
  // — one color 0.1019 in P3 vs 0.1029 in sRGB). What P3 does guarantee is a
  // richer seed and a richer family in aggregate.
  it("keeps a richer seed and richer aggregate chroma when mapped to P3", () => {
    const seeds = [
      "oklch(0.65 0.3 145)",
      "oklch(0.5 0.37 328)",
      "oklch(0.7 0.36 30)",
      "#e11d48",
    ];
    const sumC = (p: HarmonyPalette): number =>
      everyColor(p).reduce((acc, c) => acc + c.C, 0);
    for (const seed of seeds) {
      const srgb = buildHarmonyPalette(seed, { gamut: "srgb" });
      const p3 = buildHarmonyPalette(seed, { gamut: "p3" });
      expect(p3.seed.C).toBeGreaterThanOrEqual(srgb.seed.C - 1e-9);
      expect(sumC(p3)).toBeGreaterThanOrEqual(sumC(srgb) - 1e-9);
    }
  });

  // ── "Never throws" holds for ANY hostile color input (the untrusted arg) ──
  it("falls back without throwing on hostile non-string color inputs", () => {
    const hostile: unknown[] = [
      NaN,
      Infinity,
      -Infinity,
      Symbol("x"),
      BigInt(10),
      [255, 0, 0],
      { r: 255 },
      () => "#fff",
      new Date(),
      true,
      "oklch(0.5 0.1 NaN)", // regex rejects → fallback
      "oklch(0.6 0.1 -90)", // negative hue: parseColor rejects → fallback
      "hsl(200 50% 50%)", // unsupported syntax → fallback
    ];
    for (const bad of hostile) {
      const palette = buildHarmonyPalette(bad);
      expect(palette.isFallback).toBe(true);
      // Fallback palette is still fully shaped and in gamut.
      expect(everyColor(palette)).toHaveLength(7);
      for (const color of everyColor(palette)) {
        expect(inGamut(color, "srgb")).toBe(true);
      }
    }
  });

  // ── Iteration contract: HARMONY_KINDS is safe; Object.keys leaks props ──
  // The type is Record<HarmonyKind, OkLCH[]> & { seed, isFallback }. A consumer
  // that iterates HARMONY_KINDS only ever sees arrays; one that naively walks
  // Object.entries/keys also hits `seed` (an object) and `isFallback` (a bool).
  // Pin the safe path and document the footgun so a Studio consumer doesn't map
  // over `seed` as if it were a color set.
  it("HARMONY_KINDS iterates only color arrays; Object.keys also exposes seed/isFallback", () => {
    const palette = buildHarmonyPalette("#3b82f6");
    for (const kind of HARMONY_KINDS) {
      expect(Array.isArray(palette[kind])).toBe(true);
    }
    expect(Object.keys(palette)).toEqual([
      "analogous",
      "complementary",
      "triadic",
      "split-complementary",
      "seed",
      "isFallback",
    ]);
    // The two non-array keys a naive Object.entries walk would trip on:
    const nonArrayKeys = Object.entries(palette)
      .filter(([, v]) => !Array.isArray(v))
      .map(([k]) => k);
    expect(nonArrayKeys).toEqual(["seed", "isFallback"]);
  });

  // ── Determinism across gamuts, not just the default ──
  it("is deterministic per gamut and independent from the default-opts call", () => {
    expect(buildHarmonyPalette("#e11d48", { gamut: "p3" })).toEqual(
      buildHarmonyPalette("#e11d48", { gamut: "p3" }),
    );
    expect(buildHarmonyPalette("#e11d48", {})).toEqual(
      buildHarmonyPalette("#e11d48"),
    );
  });

  // ── KNOWN BOUNDARY (QA-102 finding): the "never throws" guarantee is scoped ──
  // to the untrusted color arg. `opts` is typed, so passing `null` (a TYPE
  // violation, not reachable from well-typed callers) reads `null.gamut` and
  // throws. Untrusted data that reaches this from an `unknown` boundary would
  // crash rather than fall back. Hardening `opts.gamut` → `opts?.gamut` closes
  // it; this test pins the CURRENT behavior so a fix flips it deliberately.
  it("(known gap) throws on an explicitly-null opts — recommend opts?.gamut", () => {
    expect(() =>
      buildHarmonyPalette("#3b82f6", null as unknown as undefined),
    ).toThrow(TypeError);
    // The well-typed shapes it is meant to accept never throw:
    expect(() => buildHarmonyPalette("#3b82f6")).not.toThrow();
    expect(() => buildHarmonyPalette("#3b82f6", {})).not.toThrow();
    expect(() =>
      buildHarmonyPalette("#3b82f6", { gamut: undefined }),
    ).not.toThrow();
  });
});
