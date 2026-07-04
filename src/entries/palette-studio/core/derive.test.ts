import { describe, expect, it } from "vitest";
import {
  BRAND_TOKEN_NAMES,
  buildTokenSet,
  inGamut,
  parseColor,
  RAMP_LABELS,
  RAMP_ROLES,
  type ChromaPolicy,
  type Gamut,
  type HuePolicy,
  type LightnessDistribution,
} from "@garden/oklch";
import type { BindingProvenance, StepProvenance } from "@garden/oklch";
import { DEFAULT_GAMUT, DEFAULT_RULES, type StudioRules } from "./rules";
import { derivePalette, describeAnchor, parseSeed } from "./derive";

/** Narrow a provenance to its ramp-step form (surfaces + `auto` tokens), else null. */
const asStep = (p: BindingProvenance): StepProvenance | null =>
  p?.kind === "step" ? p : null;

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

  it("accepts hsl()/hsla() by normalizing to rgb ahead of the engine parser (QA-131 D3)", () => {
    // Modern space syntax ≡ its rgb equivalent, through the SAME parser+map path.
    const viaHsl = parseSeed("hsl(210 50% 50%)");
    expect(viaHsl.isFallback).toBe(false);
    expect(viaHsl.oklch).toEqual(parseSeed("rgb(64 128 191)").oklch);
    // Legacy comma syntax, alpha (ignored — seeds are opaque), and hue wrap-around.
    expect(parseSeed("hsl(210, 50%, 50%)").oklch).toEqual(viaHsl.oklch);
    expect(parseSeed("hsla(210 50% 50% / 0.4)").oklch).toEqual(viaHsl.oklch);
    expect(parseSeed("hsl(570 50% 50%)").oklch).toEqual(viaHsl.oklch);
    // The palette derives from the same normalized seed the readout shows.
    const palette = derivePalette("hsl(210 50% 50%)", DEFAULT_RULES, "srgb");
    const viaRgb = derivePalette("rgb(64 128 191)", DEFAULT_RULES, "srgb");
    expect(palette.light.tokens.accent).toEqual(viaRgb.light.tokens.accent);
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
    expect(bg.light.boundTo).toEqual({
      kind: "step",
      role: "neutral",
      label: "50",
    });
    expect(bg.dark.boundTo).toEqual({
      kind: "step",
      role: "neutral",
      label: "950",
    });
    const text = rows.find((r) => r.name === "text")!;
    expect(asStep(text.light.boundTo)?.role).toBe("neutral");
    expect(asStep(text.dark.boundTo)?.role).toBe("neutral");
  });

  it("binds accent-text / focus-ring to the brand ramp", () => {
    const { rows } = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT);
    for (const name of ["accent-text", "focus-ring"] as const) {
      const row = rows.find((r) => r.name === name)!;
      expect(asStep(row.light.boundTo)?.role).toBe("brand");
    }
  });

  it("reports the accent + on-accent co-solve stories, not a discrete step", () => {
    const { rows } = derivePalette(SEED, DEFAULT_RULES, DEFAULT_GAMUT);
    for (const name of ["accent", "on-accent"] as const) {
      const row = rows.find((r) => r.name === name)!;
      // No longer null — each carries a first-class co-solve report tagged by kind (#151).
      expect(row.light.boundTo?.kind).toBe(name);
      expect(row.dark.boundTo?.kind).toBe(name);
      expect(asStep(row.light.boundTo)).toBeNull();
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
        expect(asStep(row.light.boundTo)?.role, `${name}/light`).toBe(
          "neutral",
        );
        expect(asStep(row.dark.boundTo)?.role, `${name}/dark`).toBe("neutral");
      }
      // …while accent-text / focus-ring still name the brand ramp.
      for (const name of ["accent-text", "focus-ring"] as const) {
        const row = rows.find((r) => r.name === name)!;
        expect(asStep(row.light.boundTo)?.role, `${name}/light`).toBe("brand");
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
          const bound = asStep(cell.boundTo);
          if (!bound) continue; // continuous co-solve — no discrete step to check
          const view = palette[scheme];
          const step = view.ramps[bound.role].find(
            (s) => s.label === bound.label,
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

// Adversarial QA (QA-S13) for the headless derivation core. Attacks the boundaries the
// author's happy-path suite skipped: hostile seeds, the parse-honesty contract the UI's
// `aria-invalid` rides on, and the full rule cross-product. Pure — no DOM.

// A hostile roster the happy path never sends through: malformed, out-of-range, unicode,
// pathological-length, and the engine's documented clamp boundaries (near-white/black,
// achromatic). NONE may throw; every one must yield a complete palette.
const HOSTILE_SEEDS: readonly string[] = [
  "",
  "   ",
  "\t\n",
  "#",
  "#f",
  "#ff",
  "#ffff", // 4-digit hex — not a valid CSS form, must fall back honestly
  "#fffffff", // 7 digits
  "#ffffffff", // 8-digit hex (alpha) — engine drops alpha; must not throw
  "#zzz",
  "#ZZZZZZ",
  "rgb(999 -5 300)", // out-of-range channels
  "rgb(0,0,0)",
  "rgba(255 255 255 / 0.5)",
  "oklch(2 5 999)", // L, C, H all out of nominal range
  "oklch(-1 -1 -1)",
  "oklch(x y z)",
  "hsl(0 0 0)", // invalid hsl syntax (s/l require %)
  "not-a-color",
  "🎨🌈",
  "  #16a34a  ", // surrounding whitespace
  "RGB(124 58 237)", // uppercase function
  "#16A34A", // uppercase hex
  "a".repeat(10000), // pathological length
];

// Boundary + achromatic seeds that stress the anchor-L clamp (~0.15…0.98) and the
// tinted-neutral / brand-ramp convergence path.
const BOUNDARY_SEEDS: readonly string[] = [
  "#000",
  "#000000",
  "#fff",
  "#ffffff",
  "#808080",
  "#010101",
  "#fefefe",
  "oklch(0 0 0)",
  "oklch(1 0 0)",
  "oklch(0.5 0 120)", // achromatic mid
];

describe("QA-S13 · derivePalette — hostile seeds never break the tool", () => {
  it.each([...HOSTILE_SEEDS, ...BOUNDARY_SEEDS])(
    "yields a complete, non-throwing palette for %j",
    (seed) => {
      const palette = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT);
      // Structurally complete regardless of validity.
      expect(palette.rows).toHaveLength(BRAND_TOKEN_NAMES.length);
      expect(palette.rows.map((r) => r.name)).toEqual([...BRAND_TOKEN_NAMES]);
      for (const view of [palette.light, palette.dark]) {
        expect(Object.keys(view.ramps)).toEqual([...RAMP_ROLES]);
        for (const role of RAMP_ROLES) {
          expect(view.ramps[role].map((s) => s.label)).toEqual([
            ...RAMP_LABELS,
          ]);
          for (const step of view.ramps[role]) {
            expect(Number.isFinite(step.color.L)).toBe(true);
            expect(Number.isFinite(step.color.C)).toBe(true);
            expect(Number.isFinite(step.color.H)).toBe(true);
          }
        }
      }
    },
  );

  it("isFallback is HONEST — agrees with parseSeed and the engine parser for every seed", () => {
    // The UI wires `aria-invalid` off parseSeed but paints the palette off derivePalette;
    // if these two ever disagreed, the input would claim valid while showing a fallback (or
    // vice versa). They must agree with each other AND with the engine's own parser.
    for (const seed of [...HOSTILE_SEEDS, ...BOUNDARY_SEEDS]) {
      const viaParse = parseSeed(seed).isFallback;
      const viaDerive = derivePalette(
        seed,
        DEFAULT_RULES,
        DEFAULT_GAMUT,
      ).isFallback;
      const viaEngine = parseColor(seed) === null;
      expect(
        viaParse,
        `parseSeed vs derive disagree for ${JSON.stringify(seed)}`,
      ).toBe(viaDerive);
      expect(
        viaParse,
        `parseSeed vs engine parser disagree for ${JSON.stringify(seed)}`,
      ).toBe(viaEngine);
    }
  });

  it("a valid seed is never mislabeled as fallback (near-white/black/achromatic)", () => {
    for (const seed of ["#000", "#fff", "#808080", "oklch(0.5 0 120)"]) {
      expect(
        derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT).isFallback,
        seed,
      ).toBe(false);
    }
  });
});

describe("QA-S13 · rule cross-product — every combination derives cleanly", () => {
  const DISTS: readonly LightnessDistribution[] = [
    "tailwind",
    "linear",
    "eased",
    "punchy",
    "soft",
  ];
  const CHROMAS: readonly ChromaPolicy[] = ["flat", "taper", "hold"];
  const HUES: readonly HuePolicy[] = [
    "constant",
    "warm-shadows",
    "cool-highlights",
  ];
  const GAMUTS: readonly Gamut[] = ["srgb", "p3"];

  // 180 full engine runs — generous timeout so it can't flake under a loaded parallel gate
  // (the engine's own QA-102 grid test uses the same guard).
  it(
    "all 5×3×3×2×2 = 180 rule combinations: 11 steps + strictly monotonic lightness, no throw",
    { timeout: 30000 },
    () => {
      let combos = 0;
      for (const distribution of DISTS)
        for (const chromaPolicy of CHROMAS)
          for (const huePolicy of HUES)
            for (const tintedNeutrals of [true, false])
              for (const gamut of GAMUTS) {
                combos++;
                const p = derivePalette(
                  "#7c3aed",
                  { distribution, chromaPolicy, huePolicy, tintedNeutrals },
                  gamut,
                );
                const tag = `${distribution}/${chromaPolicy}/${huePolicy}/tn=${tintedNeutrals}/${gamut}`;
                for (const view of [p.light, p.dark]) {
                  for (const role of RAMP_ROLES) {
                    const ramp = view.ramps[role];
                    expect(ramp, `${tag} ${role} step count`).toHaveLength(11);
                    const Ls = ramp.map((s) => s.color.L);
                    for (let i = 1; i < Ls.length; i++) {
                      // 50 is lightest, 950 darkest → strictly decreasing L.
                      expect(
                        Ls[i],
                        `${tag} ${view.scheme} ${role} not monotonic at step ${i}`,
                      ).toBeLessThan(Ls[i - 1]);
                    }
                  }
                }
              }
      expect(combos).toBe(180);
    },
  );

  it("tintedNeutrals:false forces a pure achromatic neutral ramp in BOTH schemes", () => {
    const p = derivePalette(
      "#7c3aed",
      { ...DEFAULT_RULES, tintedNeutrals: false },
      DEFAULT_GAMUT,
    );
    for (const view of [p.light, p.dark]) {
      for (const step of view.ramps.neutral) {
        expect(step.color.C, `${view.scheme} neutral ${step.label}`).toBe(0);
      }
    }
  });
});
