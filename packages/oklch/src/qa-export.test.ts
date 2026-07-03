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
   * (with optional `alpha`/`hex`). A plain CSS string — `"#ff0000"` and *especially*
   * `"oklch(0.47 0.188 259.81)"` (which no DTCG draft has ever accepted) — is NOT a
   * valid color value. This engine emits a string, defaulting to `oklch(...)`.
   *
   * Marked `it.fails`: it documents the claim-vs-reality gap and stays green until the
   * shape is fixed. If the author moves `$value` to the DTCG object form (the natural,
   * lossless fit for an OKLCH-native engine — `{ colorSpace: "oklch", components: [L,C,H] }`),
   * this assertion starts PASSING and `it.fails` flips red → remove the marker.
   */
  it.fails(
    "default $value is a DTCG-conformant color object, not a CSS string",
    () => {
      const tokens = tokenSetToDesignTokens(buildTokenSet(SEED));
      const value = tokens.light.semantic.accent.$value as unknown;
      expect(typeof value).toBe("object");
      expect(value).toMatchObject({
        colorSpace: expect.any(String),
        components: expect.arrayContaining([expect.any(Number)]),
      });
    },
  );

  it("PINS current behavior: default $value is an oklch() CSS string (drift guard)", () => {
    const tokens = tokenSetToDesignTokens(buildTokenSet(SEED));
    const value = tokens.light.semantic.accent.$value;
    expect(typeof value).toBe("string");
    expect(value).toMatch(/^oklch\(/);
    // The default value is not even a legacy hex/rgb string a pre-object DTCG tool
    // would read — it is an oklch() function no DTCG consumer accepts.
    expect(value).not.toMatch(/^#[0-9a-f]{6}$/);
    expect(value).not.toMatch(/^rgb\(/);
  });

  it("hex-format $value is at least a bare hex string (legacy-tool readable)", () => {
    const tokens = tokenSetToDesignTokens(buildTokenSet(SEED), {
      format: "hex",
    });
    expect(tokens.light.semantic.accent.$value).toMatch(/^#[0-9a-f]{6}$/);
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
