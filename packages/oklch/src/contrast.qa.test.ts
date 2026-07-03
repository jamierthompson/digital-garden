/**
 * Adversarial QA for `checkContrast` (#100) — the edge/error/boundary cases the author's
 * `contrast.test.ts` suite skipped. These pin the engine's contracts (never-throws,
 * inclusive `>=` floor, polarity-awareness, and "identical semantics" with the primitives
 * it consolidated) so a future change that quietly diverges is caught.
 */
import { describe, expect, it } from "vitest";

import {
  apcaLc,
  checkContrast,
  contrastWCAG,
  type ContrastTarget,
} from "./contrast";
import { resolveTheme } from "./palette";
import { parseColor } from "./convert";
import type { OkLCH } from "./types";

const WHITE = parseColor("#ffffff")!;
const BLACK = parseColor("#000000")!;
const BODY: ContrastTarget = { wcag: 4.5, apca: 75 };

describe("checkContrast — never-throws contract (#100)", () => {
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
  it("reports the APCA deltaYmin floor as 0 and WCAG as 1 for identical colors", () => {
    const check = checkContrast(WHITE, WHITE, BODY);
    expect(check.apca).toBe(0);
    expect(check.wcag).toBeCloseTo(1, 10);
    expect(check.passes).toBe(false);
  });
});

describe("checkContrast — polarity awareness (#100)", () => {
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
  // The commit claims every solve/binding now routes through checkContrast with IDENTICAL
  // semantics to the old inline `contrastWCAG(...) >= wcag && apcaLc(...) >= apca`. This
  // catches any future divergence of checkContrast from that exact predicate, across hues
  // and both schemes (real engine-derived colors, not hand-picked pairs).
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
