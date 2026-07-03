import { describe, expect, it } from "vitest";

import { buildTokenSet } from "./palette";
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

  it("shapes every token as { $type: 'color', $value }", () => {
    const accent = tokens.light.semantic.accent;
    expect(accent.$type).toBe("color");
    expect(accent.$value).toMatch(/^oklch\(/);
  });

  it("is plain JSON (survives a stringify round-trip)", () => {
    expect(JSON.parse(JSON.stringify(tokens))).toEqual(tokens);
  });

  it("serializes hex / rgb values on request", () => {
    const hex = tokenSetToDesignTokens(buildTokenSet(SEED), { format: "hex" });
    expect(hex.dark.semantic.text.$value).toMatch(/^#[0-9a-f]{6}$/);
    const rgb = tokenSetToDesignTokens(buildTokenSet(SEED), { format: "rgb" });
    expect(rgb.light.ramps.brand["500"].$value).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
  });

  it("dark values genuinely differ from light (the re-solve is visible)", () => {
    expect(tokens.light.semantic.text.$value).not.toBe(
      tokens.dark.semantic.text.$value,
    );
  });
});
