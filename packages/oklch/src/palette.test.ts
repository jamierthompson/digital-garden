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
