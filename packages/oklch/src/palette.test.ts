import { describe, expect, it } from "vitest";

import { buildTokenSet, resolveTheme } from "./palette";
import { inGamut } from "./gamut";
import { apcaLc, contrastWCAG } from "./contrast";
import { parseColor } from "./convert";
import type { BrandTokenName, Scheme, SchemeResult } from "./types";

const TOKEN_NAMES: BrandTokenName[] = [
  "bg",
  "surface",
  "surface-2",
  "text",
  "text-muted",
  "border",
  "accent",
  "accent-text",
  "on-accent",
  "focus-ring",
  "success",
  "error",
  "warning",
  "info",
];

const SCHEMES: Scheme[] = ["light", "dark"];

describe("resolveTheme", () => {
  it.each(SCHEMES)(
    "emits every token, in gamut, for the %s scheme",
    (scheme) => {
      const { tokens } = resolveTheme("#3b82f6", scheme);
      for (const name of TOKEN_NAMES) {
        expect(tokens[name], name).toBeDefined();
        expect(inGamut(tokens[name], "srgb"), name).toBe(true);
      }
    },
  );

  it("is deterministic — same input → identical output", () => {
    expect(resolveTheme("#e11d48", "light")).toEqual(
      resolveTheme("#e11d48", "light"),
    );
    expect(resolveTheme("#e11d48", "dark")).toEqual(
      resolveTheme("#e11d48", "dark"),
    );
  });

  it("produces a light scheme with a light bg and a dark scheme with a dark bg", () => {
    expect(resolveTheme("#3b82f6", "light").tokens.bg.L).toBeGreaterThan(0.9);
    expect(resolveTheme("#3b82f6", "dark").tokens.bg.L).toBeLessThan(0.3);
  });

  it("dampens chroma in dark vs light for the seed", () => {
    const light = resolveTheme("#e11d48", "light");
    const dark = resolveTheme("#e11d48", "dark");
    expect(dark.seed.C).toBeLessThan(light.seed.C);
  });

  it("honors an explicit P3 gamut", () => {
    const { tokens } = resolveTheme("oklch(0.7 0.34 145)", "light", {
      gamut: "p3",
    });
    for (const name of TOKEN_NAMES) {
      expect(inGamut(tokens[name], "p3"), name).toBe(true);
    }
  });

  describe("defensive fallback", () => {
    it("never throws on garbage input and flags the fallback", () => {
      const bad: unknown[] = [
        "",
        "nonsense",
        "#zzz",
        null,
        undefined,
        42,
        {},
        [],
      ];
      for (const input of bad) {
        expect(() => resolveTheme(input, "light")).not.toThrow();
        const result = resolveTheme(input, "light");
        expect(result.isFallback).toBe(true);
        for (const name of TOKEN_NAMES) {
          expect(inGamut(result.tokens[name], "srgb"), name).toBe(true);
        }
      }
    });

    it("does NOT flag the fallback for a valid color", () => {
      expect(resolveTheme("#3b82f6", "light").isFallback).toBe(false);
    });

    it("returns a usable, deterministic fallback palette", () => {
      expect(resolveTheme("garbage", "light")).toEqual(
        resolveTheme("also garbage", "light"),
      );
    });
  });
});

// The engine's own contrast floors (accessibility-and-performance.md, mirrored by the
// palette's `TARGET`): a UI/non-text element clears WCAG 3:1 + APCA Lc 45; a label on the
// accent fill clears WCAG 4.5 + APCA Lc 60. Asserted below with the REAL contrast fns so
// these tests prove accessibility against the actual solved colors rather than snapshotting
// specific token values (which are free to change as the solve improves).
const UI_FLOOR = { wcag: 3, apca: 45 } as const;
const ON_ACCENT_FLOOR = { wcag: 4.5, apca: 60 } as const;

/**
 * Prove a resolved scheme is accessible: its accent reads as a UI element on the
 * worst-case surface (`surface-2`) and its on-accent label reads on the accent fill.
 */
function expectAccessibleAccent(result: SchemeResult, label: string): void {
  const surface2 = result.tokens["surface-2"];
  const { accent } = result.tokens;
  const onAccent = result.tokens["on-accent"];

  expect(
    contrastWCAG(accent, surface2),
    `${label}: accent WCAG vs surface-2`,
  ).toBeGreaterThanOrEqual(UI_FLOOR.wcag);
  expect(
    apcaLc(accent, surface2),
    `${label}: accent APCA vs surface-2`,
  ).toBeGreaterThanOrEqual(UI_FLOOR.apca);
  expect(
    contrastWCAG(onAccent, accent),
    `${label}: on-accent WCAG vs accent`,
  ).toBeGreaterThanOrEqual(ON_ACCENT_FLOOR.wcag);
  expect(
    apcaLc(onAccent, accent),
    `${label}: on-accent APCA vs accent`,
  ).toBeGreaterThanOrEqual(ON_ACCENT_FLOOR.apca);
}

describe("seed-lightness auto-direction", () => {
  // Faithful native accents anchor at the seed's own lightness; a mid seed may nudge a
  // few steps. This tolerance allows the nudge + gamut-map drift without pinning a value.
  const FAITHFUL_TOL = 0.05;

  it("assigns a too-light seed to the dark scheme (its native direction)", () => {
    // Very light yellow, L ≈ 0.96 — far too light to be a primary on a light surface.
    const seed = "#faf3c0";
    const light = resolveTheme(seed, "light");
    const dark = resolveTheme(seed, "dark");
    // Detected from the seed alone → both scheme calls agree.
    expect(light.direction).toBe("dark");
    expect(dark.direction).toBe("dark");
  });

  it("honors seed L in the native (dark) scheme for a too-light seed, derives the light scheme", () => {
    const seed = "#faf3c0";
    const light = resolveTheme(seed, "light");
    const dark = resolveTheme(seed, "dark");

    // Native scheme (dark): accent lightness ≈ the seed's own lightness (brand-faithful).
    expect(Math.abs(dark.tokens.accent.L - dark.seed.L)).toBeLessThan(
      FAITHFUL_TOL,
    );
    // Off scheme (light): derived — its accent is NOT anchored to the seed's (very light) L.
    expect(light.tokens.accent.L).toBeLessThan(dark.seed.L - 0.1);

    // Both schemes stay legible: accent reads as UI, on-accent reads on the fill.
    expectAccessibleAccent(light, "too-light seed / light");
    expectAccessibleAccent(dark, "too-light seed / dark");
  });

  it("honors seed L in the native (light) scheme for a deep seed", () => {
    // Deep teal, L ≈ 0.33 — a legible primary on a light surface.
    const seed = "#0f3d3e";
    const light = resolveTheme(seed, "light");
    const dark = resolveTheme(seed, "dark");

    expect(light.direction).toBe("light");
    expect(dark.direction).toBe("light");

    // Native scheme (light): accent lightness ≈ the seed's own lightness.
    expect(Math.abs(light.tokens.accent.L - light.seed.L)).toBeLessThan(
      FAITHFUL_TOL,
    );

    expectAccessibleAccent(light, "deep seed / light");
    expectAccessibleAccent(dark, "deep seed / dark");
  });

  it("agrees on direction across both scheme calls and through buildTokenSet.meta", () => {
    const seeds = [
      "#faf3c0",
      "#0f3d3e",
      "#3b82f6",
      "#e11d48",
      "#000080",
      "#ffff00",
    ];
    for (const seed of seeds) {
      const light = resolveTheme(seed, "light");
      const dark = resolveTheme(seed, "dark");
      expect(dark.direction, seed).toBe(light.direction);
      expect(buildTokenSet(seed).meta.direction, seed).toBe(light.direction);
    }
  });

  it("stays deterministic and legible for near-threshold boundary seeds", () => {
    // The detection flips around L ≈ 0.62–0.64 (an accent that just clears / just fails
    // the UI floor on a light surface). Straddle it: one just-below, one just-above.
    const boundary = ["oklch(0.60 0.12 145)", "oklch(0.66 0.12 145)"];
    for (const seed of boundary) {
      const light = resolveTheme(seed, "light");
      const dark = resolveTheme(seed, "dark");

      // A valid, defined direction either way.
      expect(["light", "dark"]).toContain(light.direction);
      // Deterministic across repeated calls.
      expect(resolveTheme(seed, "light")).toEqual(light);
      expect(resolveTheme(seed, "dark")).toEqual(dark);
      // Legible in BOTH schemes regardless of which side of the boundary it lands on.
      expectAccessibleAccent(light, `${seed} / light`);
      expectAccessibleAccent(dark, `${seed} / dark`);
    }
  });

  it("keeps both schemes accessible across hues and lightnesses (measured, not snapshotted)", () => {
    const hues = [29, 110, 145, 195, 260, 330];
    const lightnesses = [0.25, 0.45, 0.65, 0.85, 0.96];
    for (const H of hues) {
      for (const L of lightnesses) {
        const seed = `oklch(${L} 0.14 ${H})`;
        const light = resolveTheme(seed, "light");
        const dark = resolveTheme(seed, "dark");
        expect(["light", "dark"]).toContain(light.direction);
        expectAccessibleAccent(light, `${seed} / light`);
        expectAccessibleAccent(dark, `${seed} / dark`);
      }
    }
  });

  it("yields a valid direction on garbage input via the fallback, and never throws", () => {
    const bad: unknown[] = [
      "",
      "not-a-color",
      "#zzz",
      null,
      undefined,
      42,
      {},
      [],
    ];
    for (const input of bad) {
      expect(() => resolveTheme(input, "light")).not.toThrow();
      const light = resolveTheme(input, "light");
      const dark = resolveTheme(input, "dark");
      expect(light.isFallback, String(input)).toBe(true);
      // The fallback seed still resolves to a valid, agreed-upon direction.
      expect(["light", "dark"]).toContain(light.direction);
      expect(dark.direction, String(input)).toBe(light.direction);
      expect(buildTokenSet(input).meta.direction, String(input)).toBe(
        light.direction,
      );
      // …and the fallback palette is still accessible in whichever scheme is native.
      const native = light.direction === "light" ? light : dark;
      expectAccessibleAccent(native, `fallback(${String(input)}) / native`);
    }
  });

  it("keeps the too-light seed's parsed lightness above the light-native range (sanity on the fixture)", () => {
    // Guards the fixture itself: if #faf3c0 stopped being 'too light', the direction test
    // would pass vacuously. Parsed L must be high enough to be dark-native.
    const base = parseColor("#faf3c0");
    expect(base).not.toBeNull();
    expect(base?.L).toBeGreaterThan(0.9);
  });

  it("honors seed.L in the native scheme for a light-native upper-mid seed", () => {
    // The (~0.5, ~0.63] light-native band is where the nudge must go TOWARD the surface's
    // opposite pole (darker, here) to stay faithful — not away-from-mid. direction "light"
    // is a promise the accent is anchored near seed.L, not dropped to the derived scan.
    const r = resolveTheme("oklch(0.60 0.15 260)", "light");
    expect(r.direction).toBe("light");
    expect(Math.abs(r.tokens.accent.L - r.seed.L)).toBeLessThanOrEqual(0.1);
  });

  it("has no jarring accent-L discontinuity within one direction", () => {
    // A 0.02 step in seed L, both sides light-native, must not swing accent.L by ~0.19 —
    // the symptom of the native path silently falling through to the derived scan.
    const a = resolveTheme("oklch(0.56 0.15 260)", "light");
    const b = resolveTheme("oklch(0.58 0.15 260)", "light");
    expect(a.direction).toBe(b.direction);
    expect(Math.abs(a.tokens.accent.L - b.tokens.accent.L)).toBeLessThan(0.1);
  });
});

describe("status colors", () => {
  const STATUS_TOKENS: BrandTokenName[] = [
    "success",
    "error",
    "warning",
    "info",
  ];
  // Status colors are accessible signal FOREGROUNDS solved at the accent-text tier, so
  // they clear WCAG 4.5 + APCA Lc 60 against the worst-case surface (surface-2) — the same
  // floor `accent-text` clears. Measured with the REAL contrast fns, both schemes.
  const STATUS_FLOOR = { wcag: 4.5, apca: 60 } as const;

  it.each(SCHEMES)(
    "emits all four status tokens, finite + in gamut, for the %s scheme",
    (scheme) => {
      const { tokens } = resolveTheme("#3b82f6", scheme);
      for (const name of STATUS_TOKENS) {
        const c = tokens[name];
        expect(c, name).toBeDefined();
        expect(
          Number.isFinite(c.L) && Number.isFinite(c.C) && Number.isFinite(c.H),
          name,
        ).toBe(true);
        expect(inGamut(c, "srgb"), name).toBe(true);
      }
    },
  );

  // The per-hue solve is the whole point: a fixed ΔL that passes for red fails for yellow.
  // Prove EACH canonical hue clears the floor — warning (yellow) + success (green) + info
  // (cyan-ish blue) are the stressers — across hue-spanning brand seeds AND the fallback,
  // in BOTH schemes. Status colors don't depend on the brand hue, so a garbage seed (which
  // routes through the fallback surface) must still emit accessible status colors.
  const SEEDS: unknown[] = [
    "#e11d48", // crimson
    "#eab308", // amber brand
    "#16a34a", // emerald brand
    "#06b6d4", // cyan brand
    "#7c3aed", // violet
    "garbage", // → fallback palette
    null,
    42,
  ];

  it.each(SCHEMES)(
    "every status color clears its floor on surface-2 across brands + fallback (%s)",
    (scheme) => {
      for (const seed of SEEDS) {
        const { tokens } = resolveTheme(seed, scheme);
        const surface2 = tokens["surface-2"];
        for (const name of STATUS_TOKENS) {
          const c = tokens[name];
          const where = `${name}/${scheme}/${String(seed)}`;
          expect(inGamut(c, "srgb"), where).toBe(true);
          expect(
            contrastWCAG(c, surface2),
            `${where} WCAG`,
          ).toBeGreaterThanOrEqual(STATUS_FLOOR.wcag);
          expect(apcaLc(c, surface2), `${where} APCA`).toBeGreaterThanOrEqual(
            STATUS_FLOOR.apca,
          );
        }
      }
    },
  );

  it("garbage brandColor → isFallback true AND all four status colors present + accessible", () => {
    const result = resolveTheme("not-a-color", "light");
    expect(result.isFallback).toBe(true);
    const surface2 = result.tokens["surface-2"];
    for (const name of STATUS_TOKENS) {
      const c = result.tokens[name];
      expect(c, name).toBeDefined();
      expect(contrastWCAG(c, surface2), name).toBeGreaterThanOrEqual(
        STATUS_FLOOR.wcag,
      );
      expect(apcaLc(c, surface2), name).toBeGreaterThanOrEqual(
        STATUS_FLOOR.apca,
      );
    }
  });

  it("is deterministic — same input → identical status colors", () => {
    const a = resolveTheme("#3b82f6", "dark");
    const b = resolveTheme("#3b82f6", "dark");
    for (const name of STATUS_TOKENS) {
      expect(a.tokens[name], name).toEqual(b.tokens[name]);
    }
  });

  // Locks the accessibility promise the docs make ("any brand, both schemes, both gamuts"):
  // a dense hue × L × chroma sweep in sRGB AND P3, measured with the real contrast fns.
  it("every status color clears its floor across a hue/L/chroma sweep (sRGB + P3)", () => {
    const gamuts = ["srgb", "p3"] as const;
    const Hs = [0, 27, 80, 145, 250, 330];
    const Ls = [0.1, 0.5, 0.9];
    const Cs = [0, 0.15, 0.35];
    for (const gamut of gamuts)
      for (const H of Hs)
        for (const L of Ls)
          for (const C of Cs)
            for (const scheme of SCHEMES) {
              const { tokens } = resolveTheme(`oklch(${L} ${C} ${H})`, scheme, {
                gamut,
              });
              const surface2 = tokens["surface-2"];
              for (const name of STATUS_TOKENS) {
                const c = tokens[name];
                const where = `${name}/${scheme}/${gamut}/H${H}L${L}C${C}`;
                expect(inGamut(c, gamut), where).toBe(true);
                expect(
                  contrastWCAG(c, surface2),
                  `${where} WCAG`,
                ).toBeGreaterThanOrEqual(STATUS_FLOOR.wcag);
                expect(
                  apcaLc(c, surface2),
                  `${where} APCA`,
                ).toBeGreaterThanOrEqual(STATUS_FLOOR.apca);
              }
            }
  });

  // Documents the intended design: because the hue is fixed-canonical and surface-2's brand
  // tint is capped tiny, status colors are near brand-invariant — two wildly different brands
  // land within a hair. Guards against an accidental brand-hue leak into the status solve.
  it("status colors are near brand-invariant (fixed canonical hue, only the surface-tint whisper varies)", () => {
    const a = resolveTheme("#e11d48", "light").tokens; // crimson brand
    const b = resolveTheme("#06b6d4", "light").tokens; // cyan brand
    for (const name of STATUS_TOKENS) {
      // L barely moves and the hue stays within a sub-2° wobble (from gamut-mapping against
      // the brand-tinted surface) — the canonical anchor dominates, no brand-hue leak.
      expect(Math.abs(a[name].L - b[name].L), `${name} L`).toBeLessThan(0.02);
      expect(Math.abs(a[name].H - b[name].H), `${name} H`).toBeLessThan(2);
    }
  });
});

describe("buildTokenSet", () => {
  it("zips both schemes into light/dark pairs for every token", () => {
    const set = buildTokenSet("#3b82f6");
    for (const name of TOKEN_NAMES) {
      expect(set.tokens[name].light, name).toBeDefined();
      expect(set.tokens[name].dark, name).toBeDefined();
    }
    expect(set.meta.gamut).toBe("srgb");
    expect(set.meta.isFallback).toBe(false);
  });

  it("agrees with resolveTheme per scheme (single source of truth)", () => {
    const set = buildTokenSet("#e11d48");
    const light = resolveTheme("#e11d48", "light");
    const dark = resolveTheme("#e11d48", "dark");
    expect(set.tokens.accent.light).toEqual(light.tokens.accent);
    expect(set.tokens.accent.dark).toEqual(dark.tokens.accent);
  });

  it("flags the fallback through to meta on bad input", () => {
    expect(buildTokenSet("not-a-color").meta.isFallback).toBe(true);
  });
});

// The Studio's author-time `brandColor` validation (studio/schemaTypes/shared/
// colorValidation.ts) is a thin wrapper over THIS call: it accepts a value iff
// `buildTokenSet(value).meta.isFallback === false`. The Studio has no test
// runner of its own and shouldn't grow one for ~3 lines of glue; the contract that
// actually matters — "what does the engine consider usable?" — is engine behavior, so
// it's pinned here, where the runner already exists. This is the validation oracle:
// `isFallback === false` ⇔ Studio accepts. If this boundary ever moves, author-time
// validation moves with it — which is the point.
describe("brandColor validation contract (the Studio's isFallback oracle)", () => {
  // Inputs an editor would type that the engine CAN theme with → Studio accepts.
  it.each([
    "#4f46e5", // 6-digit hex (the documented example)
    "#f00", // 3-digit shorthand hex
    "#00ff0080", // 8-digit hex (alpha ignored)
    "oklch(0.62 0.19 256)", // oklch() literal (the documented example)
    "oklch(62% 0.19 256)", // oklch() with percentage L
    "rgb(79, 70, 229)", // rgb() — accepted by the engine
    "  #4f46e5  ", // surrounding whitespace is tolerated
  ])("accepts %j (engine parses it → not a fallback)", (input) => {
    expect(buildTokenSet(input).meta.isFallback).toBe(false);
  });

  // Inputs the engine CANNOT parse → fallback → Studio rejects.
  it.each([
    "not-a-color",
    "#xyz", // non-hex digits
    "#abcd", // 4-digit hex — the engine has no #rgba form, so this falls back
    "rgb()", // malformed function
    "", // empty (the wrapper also short-circuits this to "allowed", paired with .required())
    "   ", // whitespace only
  ])("rejects %j (engine falls back)", (input) => {
    expect(buildTokenSet(input).meta.isFallback).toBe(true);
  });
});
