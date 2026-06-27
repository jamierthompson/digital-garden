import { describe, expect, it } from "vitest";

import { buildTokenSet, resolveTheme } from "./palette";
import { inGamut } from "./gamut";
import type { BrandTokenName, Scheme } from "./types";

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

  it("is deterministic — same input → identical output [D5]", () => {
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

  it("dampens chroma in dark vs light for the seed [D5]", () => {
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

  describe("defensive fallback [D9]", () => {
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

describe("buildTokenSet", () => {
  it("zips both schemes into light/dark pairs for every token [D5]", () => {
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

  it("flags the fallback through to meta on bad input [D9]", () => {
    expect(buildTokenSet("not-a-color").meta.isFallback).toBe(true);
  });
});

// The Studio's author-time `brandColor` validation (studio/schemaTypes/shared/
// colorValidation.ts) is a thin wrapper over THIS call: it accepts a value iff
// `buildTokenSet(value).meta.isFallback === false` [D9, D23]. The Studio has no test
// runner of its own and shouldn't grow one for ~3 lines of glue; the contract that
// actually matters — "what does the engine consider usable?" — is engine behavior, so
// it's pinned here, where the runner already exists. This is the validation oracle:
// `isFallback === false` ⇔ Studio accepts. If this boundary ever moves, author-time
// validation moves with it — which is the point.
describe("brandColor validation contract (the Studio's isFallback oracle) [D9, D23]", () => {
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
