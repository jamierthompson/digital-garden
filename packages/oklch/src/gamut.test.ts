import { describe, expect, it } from "vitest";

import { gamutMap, inGamut } from "./gamut";
import type { Gamut, OkLCH } from "./types";

/** Assorted seed hues spanning the wheel, incl. the yellow/cyan stressers. */
const HUES = [29, 110, 145, 195, 260, 330];

const GAMUTS: Gamut[] = ["srgb", "p3"];

describe("gamutMap", () => {
  it.each(HUES)("maps an over-saturated hue %i into sRGB gamut", (H) => {
    // C = 0.4 exceeds sRGB for every hue at mid lightness.
    const out = gamutMap({ L: 0.6, C: 0.4, H }, "srgb");
    expect(inGamut(out, "srgb")).toBe(true);
    expect(out.C).toBeLessThan(0.4);
    expect(out.L).toBeCloseTo(0.6, 2); // L is held; only chroma reduces
  });

  it.each(HUES)("maps an over-saturated hue %i into P3 gamut", (H) => {
    const out = gamutMap({ L: 0.6, C: 0.4, H }, "p3");
    expect(inGamut(out, "p3")).toBe(true);
  });

  it("P3 admits more chroma than sRGB for the same hue", () => {
    const srgb = gamutMap({ L: 0.6, C: 0.4, H: 145 }, "srgb");
    const p3 = gamutMap({ L: 0.6, C: 0.4, H: 145 }, "p3");
    expect(p3.C).toBeGreaterThanOrEqual(srgb.C);
  });

  it("leaves an already-in-gamut color unchanged", () => {
    const grey: OkLCH = { L: 0.5, C: 0, H: 0 };
    expect(gamutMap(grey, "srgb")).toEqual(grey);
  });

  it("clamps the lightness extremes to neutral", () => {
    expect(gamutMap({ L: 0, C: 0.2, H: 100 }, "srgb")).toMatchObject({
      L: 0,
      C: 0,
    });
    expect(gamutMap({ L: 1, C: 0.2, H: 100 }, "srgb")).toMatchObject({
      L: 1,
      C: 0,
    });
  });

  it("is deterministic", () => {
    const a = gamutMap({ L: 0.7, C: 0.35, H: 110 }, "srgb");
    const b = gamutMap({ L: 0.7, C: 0.35, H: 110 }, "srgb");
    expect(a).toEqual(b);
  });

  it("never throws and always returns an in-gamut color", () => {
    const gamuts: Gamut[] = ["srgb", "p3"];
    for (const gamut of gamuts) {
      for (let L = 0; L <= 1.0001; L += 0.1) {
        for (const H of HUES) {
          const out = gamutMap({ L, C: 0.5, H }, gamut);
          expect(inGamut(out, gamut)).toBe(true);
        }
      }
    }
  });
});

describe("gamutMap is memoized without changing behavior (#41)", () => {
  // The memo is transparent: repeated inputs must return the SAME result (determinism),
  // distinct keys must not collide, and the per-gamut key must keep sRGB/P3 separate.
  it("returns a deterministic, identical result for a repeated (L, C, H, gamut)", () => {
    const color: OkLCH = { L: 0.6, C: 0.4, H: 145 }; // out of sRGB → exercises the solve
    const first = gamutMap(color, "srgb");
    // Fresh input object, same values — a cache hit must match the first result exactly.
    const second = gamutMap({ L: 0.6, C: 0.4, H: 145 }, "srgb");
    expect(second).toEqual(first);
  });

  it("keys on the gamut too — the same (L, C, H) can map differently per gamut", () => {
    const lch = { L: 0.7, C: 0.28, H: 145 }; // high-chroma green: in P3, out of sRGB
    const srgb = gamutMap({ ...lch }, "srgb");
    const p3 = gamutMap({ ...lch }, "p3");
    // P3 admits more chroma than sRGB at this point, so the mapped chroma must differ —
    // proving the cache key includes `gamut` (no cross-gamut collision).
    expect(p3.C).toBeGreaterThan(srgb.C);
    expect(inGamut(srgb, "srgb")).toBe(true);
    expect(inGamut(p3, "p3")).toBe(true);
  });

  it("stays consistent across a large mixed sweep (cache fill does not perturb results)", () => {
    // Map a grid twice in interleaved order; every pair must be identical regardless of
    // cache state — the memo cannot make a later call disagree with an earlier one.
    const seen = new Map<string, OkLCH>();
    for (let pass = 0; pass < 2; pass++) {
      for (const gamut of GAMUTS) {
        for (let L = 0.1; L <= 0.9; L += 0.2) {
          for (const H of HUES) {
            const out = gamutMap({ L, C: 0.35, H }, gamut);
            const key = `${L}|${H}|${gamut}`;
            if (pass === 0) seen.set(key, out);
            else expect(out).toEqual(seen.get(key));
          }
        }
      }
    }
  });

  // The memo hands out cached objects, so it MUST NOT leak an aliasable reference — otherwise a
  // caller mutating a result would poison every later hit (the memo relies on immutability, but
  // gamutMap is public, so the invariant is enforced by copy, not convention).
  it("returns a FRESH object (never the caller's input) — an in-gamut color is copied", () => {
    const input: OkLCH = { L: 0.5, C: 0, H: 200 }; // already in sRGB gamut
    const out = gamutMap(input, "srgb");
    expect(out).not.toBe(input);
    expect(out).toEqual(input);
  });

  it("a mutated in-gamut result cannot poison a later equal-key hit", () => {
    const out = gamutMap({ L: 0.5, C: 0, H: 200 }, "srgb");
    out.L = 0.123; // vandalize the returned object
    const again = gamutMap({ L: 0.5, C: 0, H: 200 }, "srgb");
    expect(again).toEqual({ L: 0.5, C: 0, H: 200 });
  });

  it("a mutated OUT-of-gamut (solved) result cannot poison a later hit", () => {
    const out = gamutMap({ L: 0.6, C: 0.4, H: 145 }, "srgb"); // out of gamut → solved + cached
    const canonical = { L: out.L, C: out.C, H: out.H };
    out.C = 999; // vandalize the returned mapped color
    const again = gamutMap({ L: 0.6, C: 0.4, H: 145 }, "srgb");
    expect(again).not.toBe(out);
    expect(again).toEqual(canonical);
  });
});

describe("QA — adversarial: gamutMap public-API hardening (#160)", () => {
  // types.ts documents alpha as "a serialization concern: it rides through gamut-mapping
  // and contrast math untouched" — the map itself is pure L/C/H (alpha can't affect it),
  // so gamutMap reattaches the input's alpha verbatim on both the in-gamut and mapped paths.
  it("preserves alpha through the map, as types.ts documents", () => {
    expect(gamutMap({ L: 0.13, C: 0, H: 0, alpha: 0.6 }, "srgb").alpha).toBe(
      0.6,
    );
    expect(gamutMap({ L: 0.5, C: 0.9, H: 30, alpha: 0.3 }, "srgb").alpha).toBe(
      0.3,
    );
  });

  it("degrades a NaN chroma to the achromatic axis without throwing", () => {
    expect(gamutMap({ L: 0.5, C: NaN, H: 30 }, "srgb")).toEqual({
      L: 0.5,
      C: 0,
      H: 30,
    });
  });

  // An unguarded Infinity chroma would pin the binary search's `hi` forever
  // (mid = (0 + Infinity) / 2 = Infinity) — the choke-point guard degrades it to the
  // achromatic axis instead, the same landing spot as NaN, so every caller that funnels
  // chroma through gamutMap (buildRamp, buildLightnessRamp, the solves) terminates too.
  it("terminates on an Infinity chroma, degrading to the achromatic axis", () => {
    expect(gamutMap({ L: 0.5, C: Infinity, H: 30 }, "srgb")).toEqual({
      L: 0.5,
      C: 0,
      H: 30,
    });
    expect(gamutMap({ L: 0.5, C: -Infinity, H: 30 }, "srgb").C).toBe(0);
  });
});
