/**
 * QA (independent, #99): adversarial coverage for the portable export formats.
 *
 * Focus:
 *   • DTCG spec-conformance — the PR + `export.ts` cite "W3C-DTCG per the spec"
 *     (https://tr.designtokens.org/format/), but the emitted `$value` is a CSS string.
 *   • Tailwind `@theme` hygiene — no duplicate custom properties, valid hex under p3.
 */

import { describe, expect, it } from "vitest";

import { buildTokenSet } from "./palette";
import { tokenSetToDesignTokens, tokenSetToTailwindTheme } from "./export";

const SEED = "#3b82f6";

describe("DTCG export — spec conformance (#99)", () => {
  /**
   * The current W3C Design Tokens Community Group Color module
   * (https://www.designtokens.org/TR/drafts/color/, 2025.10 schema) requires a color
   * token's `$value` to be an OBJECT: `{ colorSpace: string, components: number[] }`
   * (with optional `alpha`/`hex`). A plain CSS string is NOT a valid color value.
   * QA-99 originally filed this as a FAILING reproducer (the engine emitted a CSS
   * string, defaulting to `oklch(...)` which no DTCG draft has ever accepted); the
   * export was fixed to the object form in response, and this now guards conformance.
   */
  it("default $value is a DTCG-conformant color object, not a CSS string", () => {
    const tokens = tokenSetToDesignTokens(buildTokenSet(SEED));
    const value = tokens.light.semantic.accent.$value as unknown;
    expect(typeof value).toBe("object");
    expect(value).toMatchObject({
      colorSpace: expect.any(String),
      components: expect.arrayContaining([expect.any(Number)]),
    });
  });

  it("every token in every group is object-form — no string $value anywhere", () => {
    const tokens = tokenSetToDesignTokens(buildTokenSet(SEED));
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

  it("hex-format export carries a legacy-tool-readable hex fallback", () => {
    const tokens = tokenSetToDesignTokens(buildTokenSet(SEED), {
      format: "hex",
    });
    expect(tokens.light.semantic.accent.$value.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(tokens.light.semantic.accent.$value.colorSpace).toBe("srgb");
  });
});

describe("Tailwind @theme — hygiene (#99)", () => {
  it("emits no duplicate --color-* custom properties", () => {
    const theme = tokenSetToTailwindTheme(buildTokenSet(SEED));
    const props = [...theme.matchAll(/(--color-[\w-]+):/g)].map((m) => m[1]);
    expect(new Set(props).size).toBe(props.length);
  });

  it("carries BOTH a bare semantic --color-<status> and the ramp --color-<status>-500", () => {
    // e.g. --color-success (semantic) coexists with --color-success-500 (ramp). In
    // Tailwind v4 these are the default + a shade — distinct utilities, not a collision.
    const theme = tokenSetToTailwindTheme(buildTokenSet(SEED));
    expect(theme).toMatch(/--color-success: light-dark\(/);
    expect(theme).toMatch(/--color-success-500: light-dark\(/);
  });

  it("p3-gamut hex export clamps to valid 6-digit sRGB hex (no overflow literals)", () => {
    const set = buildTokenSet("oklch(0.7 0.37 145)", { gamut: "p3" });
    const theme = tokenSetToTailwindTheme(set, { format: "hex" });
    const hexes = [...theme.matchAll(/#[0-9a-fA-F]+/g)].map((m) => m[0]);
    expect(hexes.length).toBeGreaterThan(0);
    for (const h of hexes) expect(h).toMatch(/^#[0-9a-f]{6}$/);
  });
});
