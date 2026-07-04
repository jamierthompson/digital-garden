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
// Import every type from the BARREL (not "./types") — resolving these is the freeze guard
// for the type-only public surface: the signature checks below only reach the ~6 types
// transitively named in the checked function signatures, so a STANDALONE exported type
// (e.g. `RampPair`, `SchemeTokens`) could be dropped from `index.ts` and this suite would
// stay green. VERIFIED gap: deleting `export type { RampPair }` left the signature checks
// passing (10/10); importing each barrel type here makes such a drop fail `pnpm typecheck`.
import type {
  // color primitives
  OkLCH,
  OkLab,
  RGB,
  Scheme,
  Gamut,
  ColorFormat,
  // token/ramp vocabulary
  BrandTokenName,
  RampLabel,
  RampRole,
  RampStep,
  Ramp,
  RampPair,
  SchemePair,
  SchemeTokens,
  BindingStep,
  StepProvenance,
  AccentProvenance,
  OnAccentProvenance,
  BindingProvenance,
  BindingPair,
  SchemeResult,
  TokenSet,
  // palette options
  EngineOptions,
  ContrastTargetName,
  // css options
  CssOptions,
  // export surface
  ExportOptions,
  DesignToken,
  DesignTokenScheme,
  DesignTokensExport,
  // contrast surface
  ContrastTarget,
  SolveOptions,
  // ramp surface
  RampOptions,
  RampSpec,
  // binding surface
  TokenBinding,
} from "./index";

/** Every runtime export of `@garden/oklch`, alphabetized. Type-only exports don't exist
 *  at runtime; the signature checks below guard those. */
const RUNTIME_EXPORTS = [
  "BRAND_TOKEN_NAMES",
  "CONTRAST_TARGETS",
  "DEFAULT_BINDING_SCHEMA",
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

/**
 * A compile-time roll-call of every public type. If any import above disappears from the
 * barrel, this file fails to type-check → `pnpm typecheck` fails. The runtime body is a
 * no-op; the guard is the import list resolving. If a type is intentionally added to the
 * public surface, add it to the barrel import above in the same commit.
 */
type PublicTypeSurface = {
  OkLCH: OkLCH;
  OkLab: OkLab;
  RGB: RGB;
  Scheme: Scheme;
  Gamut: Gamut;
  ColorFormat: ColorFormat;
  BrandTokenName: BrandTokenName;
  RampLabel: RampLabel;
  RampRole: RampRole;
  RampStep: RampStep;
  Ramp: Ramp;
  RampPair: RampPair;
  SchemePair: SchemePair;
  SchemeTokens: SchemeTokens;
  BindingStep: BindingStep;
  StepProvenance: StepProvenance;
  AccentProvenance: AccentProvenance;
  OnAccentProvenance: OnAccentProvenance;
  BindingProvenance: BindingProvenance;
  BindingPair: BindingPair;
  SchemeResult: SchemeResult;
  TokenSet: TokenSet;
  EngineOptions: EngineOptions;
  ContrastTargetName: ContrastTargetName;
  CssOptions: CssOptions;
  ExportOptions: ExportOptions;
  DesignToken: DesignToken;
  DesignTokenScheme: DesignTokenScheme;
  DesignTokensExport: DesignTokensExport;
  ContrastTarget: ContrastTarget;
  SolveOptions: SolveOptions;
  RampOptions: RampOptions;
  RampSpec: RampSpec;
  TokenBinding: TokenBinding;
};

describe("frozen public TYPE surface (#99) — completeness guard", () => {
  it("every documented public type is exported from the barrel", () => {
    // If this file compiled, all 30 type exports resolved. Assert the map is inhabited
    // so the test is not empty; the real guard is compile-time.
    expectTypeOf<PublicTypeSurface>().toBeObject();
  });
});

describe("the exported derivation contract (#150)", () => {
  it("exposes the named contrast tiers with their WCAG floor + APCA target", () => {
    expect(api.CONTRAST_TARGETS).toEqual({
      bodyText: { wcag: 4.5, apca: 75 },
      mutedText: { wcag: 4.5, apca: 60 },
      accentText: { wcag: 4.5, apca: 60 },
      onAccent: { wcag: 4.5, apca: 60 },
      ui: { wcag: 3, apca: 45 },
      border: { wcag: 3, apca: 30 },
    });
  });

  it("binds every semantic token — the studio can answer kind/role/target for each", () => {
    // Coverage: exactly the frozen token names, no more, no fewer.
    expect(Object.keys(api.DEFAULT_BINDING_SCHEMA).sort()).toEqual(
      [...api.BRAND_TOKEN_NAMES].sort(),
    );
    // Shape: every binding declares a kind the receipt copy switches on.
    for (const name of api.BRAND_TOKEN_NAMES) {
      expect(["step", "auto", "literal", "accent", "on-accent"]).toContain(
        api.DEFAULT_BINDING_SCHEMA[name].kind,
      );
    }
  });

  it("each auto binding's target IS a CONTRAST_TARGETS tier (one source, no restatement)", () => {
    // Identity, not deep-equality: a drifted copy of the table would fail this. This is the
    // single-source guarantee #150 exists to make — the receipt names the solver's own tier.
    const tiers = Object.values(api.CONTRAST_TARGETS);
    for (const name of api.BRAND_TOKEN_NAMES) {
      const binding = api.DEFAULT_BINDING_SCHEMA[name];
      if (binding.kind === "auto") {
        expect(tiers).toContain(binding.target);
      }
    }
  });
});
