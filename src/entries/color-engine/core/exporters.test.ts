import { describe, expect, it } from "vitest";
import {
  BRAND_TOKEN_NAMES,
  ChromaPolicy,
  formatColor,
  formatHex,
  HuePolicy,
  LightnessDistribution,
  RAMP_LABELS,
  RAMP_ROLES,
  tokenSetToDesignTokens,
  type ColorFormat,
  type TokenSet,
} from "@garden/oklch";
import { derivePalette } from "./derive";
import { DEFAULT_GAMUT, DEFAULT_RULES, type ColorEngineRules } from "./rules";
import { EXPORT_TABS, serializeExport } from "./exporters";

const set = derivePalette("#7c3aed", DEFAULT_RULES, DEFAULT_GAMUT).tokenSet;

/** Every `--name` the CSS export may legally reference: the semantic tokens + the ramp steps. */
const ALLOWED_PROPS = new Set<string>([
  ...BRAND_TOKEN_NAMES,
  ...RAMP_ROLES.flatMap((role) =>
    RAMP_LABELS.map((label) => `${role}-${label}`),
  ),
]);

describe("serializeExport — no drift from the derived palette", () => {
  it.each<ColorFormat>(["oklch", "hex", "rgb"])(
    "CSS export bakes the exact derived accent value (%s)",
    (format) => {
      const css = serializeExport("css", set, format);
      const expected = `--accent: light-dark(${formatColor(set.tokens.accent.light, format)}, ${formatColor(set.tokens.accent.dark, format)});`;
      expect(css).toContain(expected);
    },
  );

  it("the CSS export invents no names — only engine token + ramp properties", () => {
    const css = serializeExport("css", set, "oklch");
    const props = [...css.matchAll(/(--[a-z0-9-]+):/g)].map((m) =>
      m[1].slice(2),
    );
    expect(props.length).toBeGreaterThan(0);
    for (const prop of props) {
      expect(ALLOWED_PROPS.has(prop)).toBe(true);
    }
  });

  it("Tailwind export bakes the derived accent under the --color namespace", () => {
    const tw = serializeExport("tailwind", set, "oklch");
    const expected = `--color-accent: light-dark(${formatColor(set.tokens.accent.light, "oklch")}, ${formatColor(set.tokens.accent.dark, "oklch")});`;
    expect(tw).toContain("@theme");
    expect(tw).toContain(expected);
  });

  it("JSON export carries the derived accent value per scheme", () => {
    const json = JSON.parse(serializeExport("json", set, "hex"));
    expect(json.light.semantic.accent.$value.hex).toBe(
      formatHex(set.tokens.accent.light),
    );
    expect(json.dark.semantic.accent.$value.hex).toBe(
      formatHex(set.tokens.accent.dark),
    );
  });

  it("the format switch changes the serialized values", () => {
    const oklch = serializeExport("css", set, "oklch");
    const hex = serializeExport("css", set, "hex");
    expect(oklch).not.toBe(hex);
    expect(hex).toContain("--accent: light-dark(#");
  });

  it("every tab produces a non-empty string", () => {
    for (const tab of EXPORT_TABS) {
      expect(serializeExport(tab.id, set, "oklch").length).toBeGreaterThan(0);
    }
  });
});

// Adversarial QA (#107 export slice) — the no-drift contract, swept hard.
//
// The author's own exporters.test.ts pins only `accent` for the happy-path seed. This file
// attacks the actual guarantee: for HOSTILE and edge seeds (garbage → fallback, achromatic,
// near-white/near-black, p3 out-of-gamut) across ALL three export targets × ALL three
// ColorFormats × the full rules cross-product, every exported value must equal the derived
// TokenSet's value, with NO token missing and NO name invented. If the export ever drops,
// renames, or mangles a value the Color Engine shows, one of these fails.

const FORMATS: readonly ColorFormat[] = ["oklch", "hex", "rgb"];

/** Seeds chosen to stress every branch of the derivation + serializer. */
const HOSTILE_SEEDS: ReadonlyArray<{ label: string; seed: string }> = [
  { label: "garbage → fallback", seed: "definitely-not-a-color" },
  { label: "empty string → fallback", seed: "" },
  { label: "whitespace-only → fallback", seed: "   " },
  { label: "malformed hex → fallback", seed: "#gggggg" },
  { label: "achromatic grey", seed: "#808080" },
  { label: "achromatic via oklch", seed: "oklch(0.5 0 0)" },
  { label: "pure white", seed: "#ffffff" },
  { label: "pure black", seed: "#000000" },
  { label: "near-white", seed: "#fffffe" },
  { label: "near-black", seed: "#010101" },
  { label: "hue 0 red", seed: "#ff0000" },
  { label: "yellow stresser", seed: "#ffd400" },
  { label: "cyan stresser", seed: "#00e5ff" },
  { label: "high-chroma magenta", seed: "oklch(0.66 0.32 350)" },
];

/**
 * Every `--name → [lightValue, darkValue]` the serializers must emit for a set + format,
 * computed straight off the TokenSet with the SAME formatter the engine uses. This is the
 * ground truth: the export must contain exactly these, no more, no fewer.
 */
function expectedDeclarations(
  set: TokenSet,
  format: ColorFormat,
  prefix: string,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of BRAND_TOKEN_NAMES) {
    const { light, dark } = set.tokens[name];
    out.set(
      `${prefix}${name}`,
      `light-dark(${formatColor(light, format)}, ${formatColor(dark, format)})`,
    );
  }
  for (const role of RAMP_ROLES) {
    const { light, dark } = set.ramps[role];
    for (let i = 0; i < light.length; i++) {
      out.set(
        `${prefix}${role}-${light[i].label}`,
        `light-dark(${formatColor(light[i].color, format)}, ${formatColor(dark[i].color, format)})`,
      );
    }
  }
  return out;
}

/** Extract `--name: <value>;` declaration names from a CSS body (order-independent). */
function declaredNames(css: string, prefix: string): Set<string> {
  const re = new RegExp(`(${prefix}[a-z0-9-]+):`, "g");
  return new Set([...css.matchAll(re)].map((m) => m[1]));
}

describe("no-drift — CSS export equals the derived TokenSet, every seed × format", () => {
  for (const { label, seed } of HOSTILE_SEEDS) {
    for (const format of FORMATS) {
      it(`CSS: ${label} (${format})`, () => {
        const set = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT).tokenSet;
        const css = serializeExport("css", set, format);
        const expected = expectedDeclarations(set, format, "--");

        // Every derived value is present, verbatim, under its exact custom-property name.
        for (const [name, value] of expected) {
          expect(css).toContain(`${name}: ${value};`);
        }
        // …and NOTHING else was invented (the name set matches exactly).
        expect(declaredNames(css, "--")).toEqual(new Set(expected.keys()));
        // Structural sanity: scoped, layered, balanced.
        expect(css).toContain("@layer brand {");
        expect(css).toContain(":root {");
        expect(css).toContain("color-scheme: light dark;");
        expect((css.match(/{/g) ?? []).length).toBe(
          (css.match(/}/g) ?? []).length,
        );
      });
    }
  }
});

describe("no-drift — Tailwind @theme export equals the derived TokenSet, every seed × format", () => {
  for (const { label, seed } of HOSTILE_SEEDS) {
    for (const format of FORMATS) {
      it(`Tailwind: ${label} (${format})`, () => {
        const set = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT).tokenSet;
        const tw = serializeExport("tailwind", set, format);
        const expected = expectedDeclarations(set, format, "--color-");

        for (const [name, value] of expected) {
          expect(tw).toContain(`${name}: ${value};`);
        }
        expect(declaredNames(tw, "--color-")).toEqual(new Set(expected.keys()));
        expect(tw).toContain("@theme {");
        expect((tw.match(/{/g) ?? []).length).toBe(
          (tw.match(/}/g) ?? []).length,
        );
      });
    }
  }
});

describe("no-drift — JSON (DTCG) export equals the derived TokenSet, every seed × format", () => {
  for (const { label, seed } of HOSTILE_SEEDS) {
    for (const format of FORMATS) {
      it(`JSON: ${label} (${format})`, () => {
        const set = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT).tokenSet;
        const raw = serializeExport("json", set, format);
        const json = JSON.parse(raw);

        // The seam must be a faithful pass-through of the engine serializer (pretty-printed).
        expect(raw).toBe(
          JSON.stringify(tokenSetToDesignTokens(set, { format }), null, 2),
        );

        for (const scheme of ["light", "dark"] as const) {
          // Every semantic token: present, correct $type, hex fallback matches the source color.
          for (const name of BRAND_TOKEN_NAMES) {
            const tok = json[scheme].semantic[name];
            expect(tok.$type).toBe("color");
            expect(tok.$value.hex).toBe(formatHex(set.tokens[name][scheme]));
            expect(tok.$value.colorSpace).toBe(
              format === "oklch" ? "oklch" : "srgb",
            );
            expect(tok.$value.components).toHaveLength(3);
            for (const c of tok.$value.components) {
              expect(Number.isFinite(c)).toBe(true);
            }
          }
          // Every ramp step: present under its role/label with a matching hex fallback.
          for (const role of RAMP_ROLES) {
            const steps = set.ramps[role][scheme];
            for (const step of steps) {
              const tok = json[scheme].ramps[role][step.label];
              expect(tok.$value.hex).toBe(formatHex(step.color));
            }
          }
        }
      });
    }
  }
});

describe("no-drift — p3 out-of-gamut colors export as their clamped sRGB rendering, consistently", () => {
  // A p3-gamut palette with a seed that pushes past sRGB. hex/rgb are documented as the
  // CLAMPED sRGB rendering; both must clamp IDENTICALLY (never one masking, one leaking).
  const set = derivePalette(
    "oklch(0.7 0.37 320)",
    DEFAULT_RULES,
    "p3",
  ).tokenSet;

  it("hex and rgb agree channel-for-channel for every token (both are clamped sRGB)", () => {
    const cssHex = serializeExport("css", set, "hex");
    const cssRgb = serializeExport("css", set, "rgb");
    const hexNames = declaredNames(cssHex, "--");
    const rgbNames = declaredNames(cssRgb, "--");
    // Same tokens serialized in both — no format drops a token the other keeps.
    expect(hexNames).toEqual(rgbNames);
    // Every hex literal has a matching rgb() literal that round-trips to the same RGB bytes.
    // Both forms may carry ALPHA (the scrim, #160): 8-digit `#rrggbbaa` / `rgb(r g b / a)`. Match
    // either shape and compare the RGB channels (the clamped-sRGB agreement this test guards);
    // the alpha rides through both serializers untouched and is a format concern, not a channel one.
    const hexLiterals = [
      ...cssHex.matchAll(/#[0-9a-f]{6}(?:[0-9a-f]{2})?/g),
    ].map((m) => m[0]);
    const rgbLiterals = [
      ...cssRgb.matchAll(/rgb\((\d+) (\d+) (\d+)(?: \/ [\d.]+)?\)/g),
    ];
    expect(hexLiterals.length).toBe(rgbLiterals.length);
    for (let i = 0; i < hexLiterals.length; i++) {
      const rgbHex = hexLiterals[i].slice(1, 7); // the rrggbb channels, alpha aside
      const [r, g, b] = [1, 2, 3].map((k) => Number(rgbLiterals[i][k]));
      const rebuilt = ((1 << 24) | (r << 16) | (g << 8) | b)
        .toString(16)
        .slice(1);
      expect(rebuilt).toBe(rgbHex);
    }
  });

  it("the exported hex equals the TokenSet color's own gamut-mapped hex (export ≡ preview data)", () => {
    const css = serializeExport("css", set, "hex");
    for (const name of BRAND_TOKEN_NAMES) {
      expect(css).toContain(
        `--${name}: light-dark(${formatHex(set.tokens[name].light)}, ${formatHex(set.tokens[name].dark)});`,
      );
    }
  });
});

describe("no-drift — full rules cross-product keeps the CSS export complete", () => {
  const DISTS: LightnessDistribution[] = [
    "tailwind",
    "linear",
    "eased",
    "punchy",
    "soft",
  ];
  const CHROMAS: ChromaPolicy[] = ["flat", "taper", "hold"];
  const HUES: HuePolicy[] = ["constant", "warm-shadows", "cool-highlights"];
  const expectedNameCount = BRAND_TOKEN_NAMES.length + RAMP_ROLES.length * 11;

  it("every one of the 90 rule combinations exports the full, exact token set", () => {
    let combos = 0;
    for (const distribution of DISTS) {
      for (const chromaPolicy of CHROMAS) {
        for (const huePolicy of HUES) {
          for (const tintedNeutrals of [true, false]) {
            const rules: ColorEngineRules = {
              distribution,
              chromaPolicy,
              huePolicy,
              tintedNeutrals,
            };
            const set = derivePalette("#7c3aed", rules, "srgb").tokenSet;
            const css = serializeExport("css", set, "oklch");
            const names = declaredNames(css, "--");
            expect(names.size).toBe(expectedNameCount);
            expect(names).toEqual(
              new Set(expectedDeclarations(set, "oklch", "--").keys()),
            );
            combos++;
          }
        }
      }
    }
    expect(combos).toBe(90);
  });
});
