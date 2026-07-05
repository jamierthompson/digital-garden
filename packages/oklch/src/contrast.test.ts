import { describe, expect, it } from "vitest";

import {
  apcaLc,
  checkContrast,
  contrastAPCA,
  contrastWCAG,
  solveForeground,
  type ContrastTarget,
} from "./contrast";
import { minPass } from "./binding";
import { parseColor } from "./convert";
import { inGamut } from "./gamut";
import { resolveTheme } from "./palette";
import type { OkLCH } from "./types";

const BLACK = parseColor("#000000")!;
const WHITE = parseColor("#ffffff")!;

describe("contrastWCAG", () => {
  it("returns 21:1 for black on white", () => {
    expect(contrastWCAG(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for a color on itself", () => {
    expect(contrastWCAG(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastWCAG(BLACK, WHITE)).toBeCloseTo(
      contrastWCAG(WHITE, BLACK),
      6,
    );
  });
});

describe("contrastAPCA (SA98G reference anchors)", () => {
  it("black text on white ≈ Lc 106", () => {
    // Reference: APCA 0.1.9 reports Lc 106.04 for #000 on #fff.
    expect(contrastAPCA(BLACK, WHITE)).toBeCloseTo(106.04, 0);
  });

  it("white text on black ≈ Lc -107.9 (reverse polarity)", () => {
    expect(contrastAPCA(WHITE, BLACK)).toBeCloseTo(-107.89, 0);
  });

  it("apcaLc returns the magnitude regardless of polarity", () => {
    expect(apcaLc(BLACK, WHITE)).toBeCloseTo(106.04, 0);
    expect(apcaLc(WHITE, BLACK)).toBeCloseTo(107.89, 0);
  });

  it("is ~0 for identical colors", () => {
    expect(apcaLc(WHITE, WHITE)).toBe(0);
  });
});

describe("solveForeground", () => {
  const HUES = [29, 110, 145, 195, 260, 330]; // incl. yellow (110) & cyan (195)
  const lightBg: OkLCH = { L: 0.985, C: 0.004, H: 260 };
  const darkBg: OkLCH = { L: 0.17, C: 0.01, H: 260 };

  it.each(HUES)("hits the body-text target on a light bg for hue %i", (H) => {
    const fg = solveForeground({
      bg: lightBg,
      hue: H,
      chroma: 0.15,
      target: { wcag: 4.5, apca: 75 },
      gamut: "srgb",
    });
    expect(contrastWCAG(fg, lightBg)).toBeGreaterThanOrEqual(4.5);
    expect(apcaLc(fg, lightBg)).toBeGreaterThanOrEqual(75);
    expect(inGamut(fg, "srgb")).toBe(true);
    expect(fg.L).toBeLessThan(lightBg.L); // darker text on a light surface
  });

  it.each(HUES)("hits the body-text target on a dark bg for hue %i", (H) => {
    const fg = solveForeground({
      bg: darkBg,
      hue: H,
      chroma: 0.15,
      target: { wcag: 4.5, apca: 75 },
      gamut: "srgb",
    });
    expect(contrastWCAG(fg, darkBg)).toBeGreaterThanOrEqual(4.5);
    expect(apcaLc(fg, darkBg)).toBeGreaterThanOrEqual(75);
    expect(fg.L).toBeGreaterThan(darkBg.L); // lighter text on a dark surface
  });

  it("backs off chroma when a vivid hue cannot meet the target at full chroma", () => {
    // Yellow links at high chroma can't clear 4.5:1 on white — the solver desaturates.
    const fg = solveForeground({
      bg: lightBg,
      hue: 110,
      chroma: 0.2,
      target: { wcag: 4.5, apca: 60 },
      gamut: "srgb",
    });
    expect(contrastWCAG(fg, lightBg)).toBeGreaterThanOrEqual(4.5);
    expect(fg.C).toBeLessThan(0.2);
  });

  it("is deterministic", () => {
    const opts = {
      bg: lightBg,
      hue: 195,
      chroma: 0.12,
      target: { wcag: 4.5, apca: 75 },
      gamut: "srgb" as const,
    };
    expect(solveForeground(opts)).toEqual(solveForeground(opts));
  });
});

describe("checkContrast (#100)", () => {
  const BODY = { wcag: 4.5, apca: 75 };

  it("reports pass with the measured values for a clearing pair", () => {
    const check = checkContrast(BLACK, WHITE, BODY);
    expect(check.passes).toBe(true);
    expect(check.wcag).toBeCloseTo(21, 0);
    expect(check.apca).toBeGreaterThan(100);
  });

  it("reports fail (not a throw, not a lie) when nothing clears", () => {
    const grey: OkLCH = { L: 0.5, C: 0, H: 0 };
    const nearGrey: OkLCH = { L: 0.55, C: 0, H: 0 };
    const check = checkContrast(nearGrey, grey, BODY);
    expect(check.passes).toBe(false);
    expect(check.wcag).toBeLessThan(4.5);
    expect(check.apca).toBeLessThan(75);
  });

  it("agrees with the primitive measurements it composes", () => {
    const fg = parseColor("#7c3aed")!;
    const check = checkContrast(fg, WHITE, BODY);
    expect(check.wcag).toBe(contrastWCAG(fg, WHITE));
    expect(check.apca).toBe(apcaLc(fg, WHITE));
  });

  it("requires BOTH floors — WCAG-only or APCA-only is a fail", () => {
    const fg = parseColor("#767676")!; // ~4.54:1 on white, Lc ~64 — clears WCAG, not Lc 75
    const check = checkContrast(fg, WHITE, BODY);
    expect(check.wcag).toBeGreaterThanOrEqual(4.5);
    expect(check.apca).toBeLessThan(75);
    expect(check.passes).toBe(false);
  });

  // The engine-wide guarantee, restated through the public check: every auto-bound token
  // the schema targets actually clears per checkContrast — hue-spanning, both schemes.
  const SEEDS = ["#3b82f6", "#eab308", "#06b6d4", "#dc2626", "#16a34a"];
  const SCHEMES = ["light", "dark"] as const;
  for (const scheme of SCHEMES) {
    it.each(SEEDS)(
      `text clears body text on surface-2 (%s, ${scheme})`,
      (seed) => {
        const { tokens } = resolveTheme(seed, scheme);
        expect(
          checkContrast(tokens.text, tokens["surface-2"], BODY).passes,
        ).toBe(true);
      },
    );
  }

  it("honestly reports the minPass extreme fallback as failing an absurd target", () => {
    const absurd = { wcag: 22, apca: 110 }; // unreachable by construction
    const { ramps, tokens } = resolveTheme("#3b82f6", "light");
    const fallback = minPass(ramps.neutral, tokens["surface-2"], absurd);
    // minPass always resolves (the highest-contrast extreme) …
    expect(fallback.label).toBeDefined();
    // … and the public check tells the truth about it rather than inheriting "resolved" as "passes".
    expect(
      checkContrast(fallback.color, tokens["surface-2"], absurd).passes,
    ).toBe(false);
  });
});

// The edge/error/boundary cases the happy-path checkContrast suite above skips (#100): these
// pin the never-throws contract, the inclusive `>=` floor, degenerate/unclamped targets,
// polarity propagation, and "identical semantics" with the raw two-floor predicate the public
// check consolidated — so a future change that quietly diverges is caught.
describe("checkContrast — never-throws contract (#100)", () => {
  const BODY: ContrastTarget = { wcag: 4.5, apca: 75 };

  // The engine's public promise is "never throws" even for garbage the TS type allows
  // (OkLCH is just {L,C,H: number} — nothing stops NaN/Infinity/out-of-range).
  const garbage: [string, OkLCH][] = [
    ["NaN channels", { L: NaN, C: NaN, H: NaN }],
    ["Infinity L", { L: Infinity, C: 0, H: 0 }],
    ["-Infinity L", { L: -Infinity, C: 0, H: 0 }],
    ["negative L, absurd H", { L: -5, C: 0.5, H: 720 }],
    ["huge chroma", { L: 0.5, C: 999, H: 0 }],
    ["empty object", {} as unknown as OkLCH],
  ];

  it.each(garbage)("does not throw on %s (as fg)", (_name, c) => {
    expect(() => checkContrast(c, WHITE, BODY)).not.toThrow();
  });

  it.each(garbage)("does not throw on %s (as bg)", (_name, c) => {
    expect(() => checkContrast(WHITE, c, BODY)).not.toThrow();
  });

  it("fails safe (passes=false), never a false-positive, on NaN-producing input", () => {
    // A garbage foreground must not accidentally REPORT as accessible.
    const check = checkContrast({ L: NaN, C: NaN, H: NaN }, WHITE, BODY);
    expect(check.passes).toBe(false);
  });

  it("does not throw and returns passes=false when the target itself is NaN", () => {
    // NaN comparisons are always false → cannot spuriously pass.
    const check = checkContrast(BLACK, WHITE, { wcag: NaN, apca: NaN });
    expect(check.passes).toBe(false);
  });
});

describe("checkContrast — the `>=` floor is inclusive at the boundary (#100)", () => {
  const w = contrastWCAG(BLACK, WHITE);
  const a = apcaLc(BLACK, WHITE);

  it("passes when measured values sit EXACTLY on the floor", () => {
    expect(checkContrast(BLACK, WHITE, { wcag: w, apca: a }).passes).toBe(true);
  });

  it("fails one hair over the WCAG floor", () => {
    expect(
      checkContrast(BLACK, WHITE, { wcag: w + 1e-9, apca: a }).passes,
    ).toBe(false);
  });

  it("fails one hair over the APCA floor", () => {
    expect(
      checkContrast(BLACK, WHITE, { wcag: w, apca: a + 1e-9 }).passes,
    ).toBe(false);
  });
});

describe("checkContrast — degenerate targets (no lower clamp) (#100)", () => {
  it("a zero target passes for ANY pair, including identical colors", () => {
    // Documents that checkContrast does not floor the target — {0,0} is 'always passes'.
    expect(checkContrast(WHITE, WHITE, { wcag: 0, apca: 0 }).passes).toBe(true);
  });

  it("a negative target also passes (comparison, not validation)", () => {
    expect(checkContrast(WHITE, WHITE, { wcag: -5, apca: -5 }).passes).toBe(
      true,
    );
  });
});

describe("checkContrast — identical / zero-delta colors (#100)", () => {
  const BODY: ContrastTarget = { wcag: 4.5, apca: 75 };

  it("reports the APCA deltaYmin floor as 0 and WCAG as 1 for identical colors", () => {
    const check = checkContrast(WHITE, WHITE, BODY);
    expect(check.apca).toBe(0);
    expect(check.wcag).toBeCloseTo(1, 10);
    expect(check.passes).toBe(false);
  });
});

describe("checkContrast — polarity awareness (#100)", () => {
  const BODY: ContrastTarget = { wcag: 4.5, apca: 75 };

  // The docstring claims symmetric inputs are NOT assumed (APCA is polarity-aware). Pin it:
  // WCAG is symmetric; swapping fg/bg must change the APCA magnitude but not the WCAG ratio.
  it("WCAG is symmetric under fg/bg swap; APCA is not", () => {
    const fwd = checkContrast(BLACK, WHITE, BODY);
    const rev = checkContrast(WHITE, BLACK, BODY);
    expect(rev.wcag).toBeCloseTo(fwd.wcag, 10);
    // Black-on-white vs white-on-black differ in APCA — a real, load-bearing distinction.
    expect(rev.apca).not.toBeCloseTo(fwd.apca, 3);
  });
});

describe("checkContrast — identical semantics with the primitives it consolidated (#100)", () => {
  // Every solve/binding now routes through checkContrast with IDENTICAL semantics to the old
  // inline `contrastWCAG(...) >= wcag && apcaLc(...) >= apca`. This catches any future
  // divergence of checkContrast from that exact predicate, across hues and both schemes (real
  // engine-derived colors, not hand-picked pairs).
  const SEEDS = ["#3b82f6", "#eab308", "#06b6d4", "#dc2626", "#16a34a"];
  const SCHEMES = ["light", "dark"] as const;
  const TARGETS: ContrastTarget[] = [
    { wcag: 4.5, apca: 75 },
    { wcag: 3, apca: 45 },
    { wcag: 3, apca: 30 },
  ];

  for (const scheme of SCHEMES) {
    it.each(SEEDS)(
      `passes ⇔ the raw two-floor predicate for text/surface-2 (%s, ${scheme})`,
      (seed) => {
        const { tokens } = resolveTheme(seed, scheme);
        const fg = tokens.text;
        const bg = tokens["surface-2"];
        for (const target of TARGETS) {
          const check = checkContrast(fg, bg, target);
          const raw =
            contrastWCAG(fg, bg) >= target.wcag &&
            apcaLc(fg, bg) >= target.apca;
          expect(check.passes).toBe(raw);
          expect(check.wcag).toBe(contrastWCAG(fg, bg));
          expect(check.apca).toBe(apcaLc(fg, bg));
        }
      },
    );
  }
});

describe("QA — adversarial: solveForeground non-finite chroma (never-throws contract)", () => {
  const target: ContrastTarget = { wcag: 4.5, apca: 75 };
  const bg: OkLCH = { L: 0.95, C: 0.01, H: 30 };

  // chromaBackoff steps `Infinity - 0.02 → Infinity` forever, growing its candidate array
  // until V8 dies with `RangeError: Invalid array length` — on the engine's documented
  // never-throws path (solveForeground is public, #99). CONFIRMED DEFECT (QA-REPORT.md,
  // defect 3); flip `.fails` off once non-finite chroma is guarded.
  it.fails(
    "never throws for chroma: Infinity (documented 'never throws')",
    () => {
      expect(() =>
        solveForeground({
          bg,
          hue: 30,
          chroma: Infinity,
          target,
          gamut: "srgb",
        }),
      ).not.toThrow();
    },
  );

  it("degrades a NaN chroma to an achromatic solve that still meets the target", () => {
    const out = solveForeground({
      bg,
      hue: 30,
      chroma: NaN,
      target,
      gamut: "srgb",
    });
    expect(out.C).toBe(0);
    expect(checkContrast(out, bg, target).passes).toBe(true);
  });
});
