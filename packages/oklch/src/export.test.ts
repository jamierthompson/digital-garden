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
});
