/**
 * The public-surface FREEZE GUARD (#99). The engine's exported names — the module's
 * runtime exports, the canonical token/role/label lists, and the custom properties the
 * serializers emit — are the frozen contract that `EntryScope`, `cardSwatches`, Sanity
 * author-time validation, and the studio (#70/#107) depend on.
 *
 * A failure here means the contract changed. That is allowed to happen only as a
 * DELIBERATE decision (the versioning stance in `README.md`): additions extend the lists
 * below in the same commit; renames/removals are breaking and need the consumers migrated
 * in the same PR. Never "fix" this test to make an accidental drift pass.
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import * as api from "./index";
import type { ColorFormat, Scheme, SchemeResult, TokenSet } from "./types";

/** Every runtime export of `@garden/oklch`, alphabetized. Type-only exports don't exist
 *  at runtime; the signature checks below guard those. */
const RUNTIME_EXPORTS = [
  "BRAND_TOKEN_NAMES",
  "HARMONY_KINDS",
  "RAMP_LABELS",
  "RAMP_ROLES",
  "apcaLc",
  "buildHarmonyPalette",
  "buildLightnessRamp",
  "buildRamp",
  "buildTokenSet",
  "checkContrast",
  "clamp01",
  "contrastAPCA",
  "contrastWCAG",
  "formatColor",
  "formatHex",
  "formatOklch",
  "formatRgb",
  "gamutMap",
  "inGamut",
  "minPass",
  "oklabToOklch",
  "oklchToLinearRgb",
  "oklchToOklab",
  "oklchToSrgb",
  "parseColor",
  "rampSetToDeclarations",
  "resolveTheme",
  "solveForeground",
  "srgbToOklch",
  "tokenSetToCss",
  "tokenSetToDeclarations",
  "tokenSetToDesignTokens",
  "tokenSetToTailwindTheme",
] as const;

const SEMANTIC_NAMES = [
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
  "success",
  "error",
  "warning",
  "info",
] as const;

const ROLE_NAMES = [
  "brand",
  "neutral",
  "success",
  "error",
  "warning",
  "info",
] as const;

const STEP_LABELS = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

describe("the frozen public surface (#99)", () => {
  it("exports exactly the frozen runtime names", () => {
    expect(Object.keys(api).sort()).toEqual([...RUNTIME_EXPORTS]);
  });

  it("freezes the semantic token names, in emission order", () => {
    expect(api.BRAND_TOKEN_NAMES).toEqual(SEMANTIC_NAMES);
  });

  it("freezes the ramp roles and the 50…950 step labels", () => {
    expect(api.RAMP_ROLES).toEqual(ROLE_NAMES);
    expect(api.RAMP_LABELS).toEqual(STEP_LABELS);
  });

  it("emits exactly the frozen custom-property names (the CSS contract)", () => {
    const css = api.tokenSetToCss(api.buildTokenSet("#3b82f6"), "[data-x]");
    const emitted = [...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]).sort();
    const expected = [
      ...SEMANTIC_NAMES.map((name) => `--${name}`),
      ...ROLE_NAMES.flatMap((role) =>
        STEP_LABELS.map((label) => `--${role}-${label}`),
      ),
    ].sort();
    expect(emitted).toEqual(expected);
  });

  it("freezes the high-level signatures", () => {
    expectTypeOf(api.resolveTheme).parameters.toEqualTypeOf<
      [unknown, Scheme, api.EngineOptions?]
    >();
    expectTypeOf(api.resolveTheme).returns.toEqualTypeOf<SchemeResult>();
    expectTypeOf(api.buildTokenSet).parameters.toEqualTypeOf<
      [unknown, api.EngineOptions?]
    >();
    expectTypeOf(api.buildTokenSet).returns.toEqualTypeOf<TokenSet>();
    expectTypeOf(api.tokenSetToCss).parameters.toEqualTypeOf<
      [TokenSet, string, api.CssOptions?]
    >();
    expectTypeOf(api.tokenSetToTailwindTheme).returns.toEqualTypeOf<string>();
    expectTypeOf(
      api.tokenSetToDesignTokens,
    ).returns.toEqualTypeOf<api.DesignTokensExport>();
    expectTypeOf(api.formatColor).parameters.toEqualTypeOf<
      [api.OkLCH, ColorFormat]
    >();
    expectTypeOf(api.checkContrast).parameters.toEqualTypeOf<
      [api.OkLCH, api.OkLCH, api.ContrastTarget]
    >();
    expectTypeOf(api.checkContrast).returns.toEqualTypeOf<api.ContrastCheck>();
  });
});
