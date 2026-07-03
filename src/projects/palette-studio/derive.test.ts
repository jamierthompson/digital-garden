import { describe, expect, it } from "vitest";

import {
  BRAND_TOKEN_NAMES,
  buildTokenSet,
  inGamut,
  parseColor,
  RAMP_LABELS,
  RAMP_ROLES,
} from "@garden/oklch";

import { DEFAULT_GAMUT, DEFAULT_RULES, type StudioRules } from "./rules";
import { derivePalette, describeAnchor, parseSeed } from "./derive";

const SEED = "#7c3aed"; // a saturated violet — sensitive to every ramp-shaping rule
const CRIMSON = "#e11d48";

describe("parseSeed", () => {
  it("parses hex, rgb() and oklch() as valid seeds", () => {
    for (const input of ["#7c3aed", "rgb(124 58 237)", "oklch(0.66 0.2 350)"]) {
      const parsed = parseSeed(input);
      expect(parsed.isFallback).toBe(false);
      expect(parsed.oklch).not.toBeNull();
    }
  });

  it("flags unparseable and empty input as fallback with a null readout", () => {
    for (const input of ["", "   ", "not-a-color", "#zzz", "hsl(0 0 0)"]) {
      const parsed = parseSeed(input);
      expect(parsed.isFallback).toBe(true);
      expect(parsed.oklch).toBeNull();
      expect(parsed.input).toBe(input);
    }
  });

  // QA-BR: the engine's parser clamps L but echoes C/H raw, so oklch(9 9 9) parses to the
  // out-of-gamut hybrid oklch(1 9 9). The readout must show the gamut-mapped seed the palette
  // actually derives from, never that hybrid.
  it.each(["srgb", "p3"] as const)(
    "echoes the in-gamut seed the palette derives from for out-of-range oklch (%s)",
    (gamut) => {
      const parsed = parseSeed("oklch(9 9 9)", gamut);
      expect(parsed.isFallback).toBe(false);
      expect(parsed.oklch).not.toBeNull();
      // In gamut — not a half-clamped hybrid.
      expect(inGamut(parsed.oklch!, gamut)).toBe(true);
      // …and byte-identical to the seed the palette bakes from (meta.seed.light is the parsed
      // seed mapped into the same gamut; the light seed holds full chroma).
      const seedUsed = derivePalette("oklch(9 9 9)", DEFAULT_RULES, gamut)
        .tokenSet.meta.seed.light;
      expect(parsed.oklch).toEqual(seedUsed);
    },
  );

  it("leaves an already in-gamut seed unchanged in the readout", () => {
    const parsed = parseSeed("#3b82f6", "srgb");
    expect(parsed.oklch).toEqual(parseColor("#3b82f6"));
  });
});

describe("derivePalette — never throws, always a full palette", () => {
  it.each(["", "   ", "garbage", "#nope", "rgb(999)", "oklch(x y z)"])(
    "returns the safe fallback palette for invalid seed %j",
    (seed) => {
      const palette = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT);
      expect(palette.isFallback).toBe(true);
      // Still a complete, usable palette — every token, both schemes.
      expect(palette.rows).toHaveLength(BRAND_TOKEN_NAMES.length);
      expect(Object.keys(palette.light.ramps)).toEqual([...RAMP_ROLES]);
      expect(Object.keys(palette.dark.ramps)).toEqual([...RAMP_ROLES]);
    },
  );

  it("does not flag a valid seed as fallback", () => {
    expect(derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT).isFallback).toBe(
      false,
    );
  });

  it("emits every ramp as 11 labeled 50…950 steps for both schemes", () => {
    const { light, dark } = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT);
    for (const view of [light, dark]) {
      for (const role of RAMP_ROLES) {
        expect(view.ramps[role].map((s) => s.label)).toEqual([...RAMP_LABELS]);
      }
    }
  });
});

describe("token rows", () => {
  it("lists every semantic token in canonical order", () => {
    const { rows } = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT);
    expect(rows.map((r) => r.name)).toEqual([...BRAND_TOKEN_NAMES]);
  });

  it("binds surfaces + readable tokens to a neutral ramp step, both schemes", () => {
    const { rows } = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT);
    const bg = rows.find((r) => r.name === "bg")!;
    expect(bg.light.boundTo).toEqual({ role: "neutral", label: "50" });
    expect(bg.dark.boundTo).toEqual({ role: "neutral", label: "950" });
    const text = rows.find((r) => r.name === "text")!;
    expect(text.light.boundTo?.role).toBe("neutral");
    expect(text.dark.boundTo?.role).toBe("neutral");
  });

  it("binds accent-text / focus-ring to the brand ramp", () => {
    const { rows } = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT);
    for (const name of ["accent-text", "focus-ring"] as const) {
      const row = rows.find((r) => r.name === name)!;
      expect(row.light.boundTo?.role).toBe("brand");
    }
  });

  it("reports the continuously-solved accent + on-accent as unbound (no discrete step)", () => {
    const { rows } = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT);
    for (const name of ["accent", "on-accent"] as const) {
      const row = rows.find((r) => r.name === name)!;
      expect(row.light.boundTo).toBeNull();
      expect(row.dark.boundTo).toBeNull();
    }
  });

  // The whole reason the receipt reads the engine's report instead of value-matching: where
  // the brand and neutral ramps CONVERGE — an achromatic seed, or pure achromatic neutrals —
  // a value-scan decides the role by scan order, not by the schema. The report doesn't.
  it.each([
    ["achromatic seed", "#808080", DEFAULT_RULES],
    [
      "achromatic seed, untinted",
      "#808080",
      { ...DEFAULT_RULES, tintedNeutrals: false },
    ],
    [
      "pure black, untinted",
      "#000000",
      { ...DEFAULT_RULES, tintedNeutrals: false },
    ],
  ] as const)(
    "names the schema role for neutral-bound tokens even when ramps converge (%s)",
    (_label, seed, rules) => {
      const { rows } = derivePalette(seed, rules, DEFAULT_GAMUT);
      // Surfaces + near-neutral foregrounds bind the NEUTRAL ramp, per the engine schema —
      // never `brand`, even where a grey brand step shares the value.
      for (const name of [
        "bg",
        "surface",
        "surface-2",
        "text",
        "text-muted",
        "border",
      ] as const) {
        const row = rows.find((r) => r.name === name)!;
        expect(row.light.boundTo?.role, `${name}/light`).toBe("neutral");
        expect(row.dark.boundTo?.role, `${name}/dark`).toBe("neutral");
      }
      // …while accent-text / focus-ring still name the brand ramp.
      for (const name of ["accent-text", "focus-ring"] as const) {
        const row = rows.find((r) => r.name === name)!;
        expect(row.light.boundTo?.role, `${name}/light`).toBe("brand");
      }
    },
  );

  // Internal consistency: for every step-bound token, the receipt's (role, label) step is the
  // ramp step whose baked color IS the token's value — the receipt can't point at the wrong step.
  it("every reported step's color equals the token value it labels", () => {
    for (const seed of ["#808080", "#000000", SEED]) {
      const palette = derivePalette(
        seed,
        { ...DEFAULT_RULES, tintedNeutrals: false },
        DEFAULT_GAMUT,
      );
      for (const row of palette.rows) {
        for (const scheme of ["light", "dark"] as const) {
          const cell = row[scheme];
          if (cell.boundTo === null) continue; // continuous co-solve — no step to check
          const view = palette[scheme];
          const step = view.ramps[cell.boundTo.role].find(
            (s) => s.label === cell.boundTo!.label,
          );
          expect(step, `${row.name}/${scheme}`).toBeDefined();
          expect(step!.color).toEqual(cell.value);
        }
      }
    }
  });

  it("carries the resolved value the engine baked for each token", () => {
    const set = buildTokenSet(SEED);
    const { rows } = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT);
    const accent = rows.find((r) => r.name === "accent")!;
    expect(accent.light.value).toEqual(set.tokens.accent.light);
    expect(accent.dark.value).toEqual(set.tokens.accent.dark);
  });
});

describe("defaults reproduce the un-ruled engine output", () => {
  it("matches buildTokenSet with no options bit-for-bit", () => {
    const derived = derivePalette(SEED, DEFAULT_RULES, "srgb").tokenSet;
    expect(JSON.stringify(derived)).toBe(JSON.stringify(buildTokenSet(SEED)));
  });
});

describe("every rule reaches the engine", () => {
  const base = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT).tokenSet;
  const baseJson = JSON.stringify(base);

  const changes: Array<[string, Partial<StudioRules>]> = [
    ["distribution", { distribution: "punchy" }],
    ["chromaPolicy", { chromaPolicy: "taper" }],
    ["huePolicy", { huePolicy: "warm-shadows" }],
    ["tintedNeutrals", { tintedNeutrals: false }],
  ];

  it.each(changes)("changing %s changes the derived output", (_name, patch) => {
    const changed = derivePalette(
      SEED,
      { ...DEFAULT_RULES, ...patch },
      DEFAULT_GAMUT,
    ).tokenSet;
    expect(JSON.stringify(changed)).not.toBe(baseJson);
  });

  it("tintedNeutrals:false yields a pure achromatic neutral ramp", () => {
    const { light } = derivePalette(
      SEED,
      { ...DEFAULT_RULES, tintedNeutrals: false },
      DEFAULT_GAMUT,
    );
    for (const step of light.ramps.neutral) {
      expect(step.color.C).toBe(0);
    }
  });

  it("carries the gamut choice through to the engine", () => {
    const palette = derivePalette(SEED, DEFAULT_RULES, "p3");
    expect(palette.gamut).toBe("p3");
    expect(palette.tokenSet.meta.gamut).toBe("p3");
  });
});

describe("describeAnchor", () => {
  it("reads the engine's automatic anchor as a plain-English receipt", () => {
    const palette = derivePalette(CRIMSON, DEFAULT_RULES, DEFAULT_GAMUT);
    expect(describeAnchor(palette)).toBe(
      `seed pinned to brand·${palette.anchorLabel}, deriving from ${palette.direction}`,
    );
  });
});
