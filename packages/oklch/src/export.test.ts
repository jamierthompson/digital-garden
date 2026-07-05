import { describe, expect, it } from "vitest";

import { buildTokenSet } from "./palette";
import { formatHex } from "./convert";
import { tokenSetToDesignTokens, tokenSetToTailwindTheme } from "./export";
import { BRAND_TOKEN_NAMES, RAMP_LABELS, RAMP_ROLES } from "./types";

const SEED = "#3b82f6";

describe("tokenSetToTailwindTheme", () => {
  const theme = tokenSetToTailwindTheme(buildTokenSet(SEED));

  it("emits a v4 @theme block under the --color-* namespace", () => {
    expect(theme.startsWith("@theme {")).toBe(true);
    expect(theme.endsWith("}")).toBe(true);
    for (const name of BRAND_TOKEN_NAMES) {
      expect(theme).toContain(`--color-${name}: light-dark(`);
    }
  });

  it("emits every ramp step 1:1 to the Tailwind numeric scale", () => {
    for (const role of RAMP_ROLES) {
      for (const label of RAMP_LABELS) {
        expect(theme).toContain(`--color-${role}-${label}: light-dark(`);
      }
    }
  });

  it("serializes hex values on request", () => {
    const hex = tokenSetToTailwindTheme(buildTokenSet(SEED), {
      format: "hex",
    });
    expect(hex).toMatch(
      /--color-accent: light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\);/,
    );
    expect(hex).not.toContain("oklch(");
  });

  it("serializes rgb values on request", () => {
    const rgb = tokenSetToTailwindTheme(buildTokenSet(SEED), {
      format: "rgb",
    });
    expect(rgb).toMatch(
      /--color-brand-500: light-dark\(rgb\(\d+ \d+ \d+\), rgb\(\d+ \d+ \d+\)\);/,
    );
  });

  it("emits no duplicate --color-* custom properties (#99)", () => {
    const props = [...theme.matchAll(/(--color-[\w-]+):/g)].map((m) => m[1]);
    expect(new Set(props).size).toBe(props.length);
  });

  it("p3-gamut hex export clamps to valid sRGB hex — no overflow literals (#99)", () => {
    const set = buildTokenSet("oklch(0.7 0.37 145)", { gamut: "p3" });
    const p3 = tokenSetToTailwindTheme(set, { format: "hex" });
    const hexes = [...p3.matchAll(/#[0-9a-fA-F]+/g)].map((m) => m[0]);
    expect(hexes.length).toBeGreaterThan(0);
    // 6 digits for opaque tokens; the alpha-carrying `scrim` (#160) bakes to 8 (#RRGGBBAA).
    // Either way, no out-of-gamut overflow literal (each channel is a valid 2-hex byte).
    for (const h of hexes) expect(h).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
  });

  it("scrim exports validly in all three color formats (#160)", () => {
    const set = buildTokenSet(SEED);
    // oklch (default): the translucent literal carries its alpha via `/ a`.
    const oklch = tokenSetToTailwindTheme(set);
    expect(oklch).toMatch(
      /--color-scrim: light-dark\(oklch\([^)]+ \/ [0-9.]+\)/,
    );
    // hex: an 8-digit #RRGGBBAA literal (opaque tokens stay 6-digit).
    const hex = tokenSetToTailwindTheme(set, { format: "hex" });
    expect(hex).toMatch(
      /--color-scrim: light-dark\(#[0-9a-f]{8}, #[0-9a-f]{8}\)/,
    );
    // rgb: a valid rgb()/rgba() literal (no oklch leakage).
    const rgb = tokenSetToTailwindTheme(set, { format: "rgb" });
    expect(rgb).toMatch(/--color-scrim: light-dark\(rgba?\([^)]+\)/);
    expect(rgb).not.toContain("--color-scrim: light-dark(oklch");
  });
});

describe("tokenSetToDesignTokens", () => {
  const tokens = tokenSetToDesignTokens(buildTokenSet(SEED));

  it("emits per-scheme root groups with the full semantic contract", () => {
    for (const scheme of ["light", "dark"] as const) {
      expect(Object.keys(tokens[scheme].semantic).sort()).toEqual(
        [...BRAND_TOKEN_NAMES].sort(),
      );
    }
  });

  it("emits every role ramp with all 11 steps as DTCG color tokens", () => {
    for (const scheme of ["light", "dark"] as const) {
      expect(Object.keys(tokens[scheme].ramps).sort()).toEqual(
        [...RAMP_ROLES].sort(),
      );
      for (const role of RAMP_ROLES) {
        expect(Object.keys(tokens[scheme].ramps[role])).toEqual([
          ...RAMP_LABELS,
        ]);
      }
    }
  });

  it("shapes every token as a DTCG color OBJECT (colorSpace + components + hex)", () => {
    // The DTCG Color module requires an object $value — a CSS string is not conformant
    // (QA-99, https://www.designtokens.org/TR/drafts/color/).
    const accent = tokens.light.semantic.accent;
    expect(accent.$type).toBe("color");
    expect(accent.$value.colorSpace).toBe("oklch");
    expect(accent.$value.components).toHaveLength(3);
    for (const c of accent.$value.components) {
      expect(Number.isFinite(c)).toBe(true);
    }
    expect(accent.$value.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("is plain JSON (survives a stringify round-trip)", () => {
    expect(JSON.parse(JSON.stringify(tokens))).toEqual(tokens);
  });

  it("carries scrim's opacity as the DTCG `alpha` field — opaque tokens omit it (#160)", () => {
    // #160 acceptance: scrim (the engine's first alpha-carrying literal) exports its opacity
    // via the DTCG Color-module `alpha` field, not baked into the components.
    const scrim = tokens.light.semantic.scrim;
    expect(scrim.$value.alpha).toBeGreaterThan(0);
    expect(scrim.$value.alpha).toBeLessThan(1);
    // An ordinary opaque token has no `alpha` key at all (exactly as before the scrim work).
    expect("alpha" in tokens.light.semantic.text.$value).toBe(false);
  });

  it("serializes srgb components on the hex / rgb formats", () => {
    for (const format of ["hex", "rgb"] as const) {
      const out = tokenSetToDesignTokens(buildTokenSet(SEED), { format });
      const text = out.dark.semantic.text.$value;
      expect(text.colorSpace).toBe("srgb");
      for (const c of text.components) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
      expect(text.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("the components agree with the hex fallback (one paint, two encodings)", () => {
    const step = tokens.light.ramps.brand["500"].$value;
    // Re-serializing the oklch components through the sRGB path lands on the same hex.
    const [L, C, H] = step.components;
    expect(formatHex({ L, C, H })).toBe(step.hex);
  });

  it("dark values genuinely differ from light (the re-solve is visible)", () => {
    expect(tokens.light.semantic.text.$value).not.toEqual(
      tokens.dark.semantic.text.$value,
    );
  });

  it("shapes EVERY token in every group as an object $value — no CSS string anywhere (#99)", () => {
    // Completeness beyond the single-accent shape check above: a DTCG color token's `$value`
    // must be an object, never a CSS string, for every semantic token AND every ramp step.
    for (const scheme of ["light", "dark"] as const) {
      for (const token of Object.values(tokens[scheme].semantic)) {
        expect(typeof token.$value).toBe("object");
      }
      for (const ramp of Object.values(tokens[scheme].ramps)) {
        for (const token of Object.values(ramp)) {
          expect(typeof token.$value).toBe("object");
        }
      }
    }
  });
});
