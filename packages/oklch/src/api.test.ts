/**
 * The public-surface DRIFT GUARD (#99). The engine's exported names — the module's
 * runtime exports, the canonical token/role/label lists, and the custom properties the
 * serializers emit — are the surface that `EntryScope`, `cardSwatches`, Sanity author-time
 * validation, and the studio (#70/#107) depend on.
 *
 * `@garden/oklch` is internal and project-only (this repo is its only consumer), so that
 * surface is freely changeable — this test is a tripwire against SILENT drift, not a wall.
 * A failure means the surface changed; that is fine as a DELIBERATE decision (the versioning
 * stance in `README.md`): additions extend the lists below in the same commit; renames/removals
 * migrate the consumers in the same PR. The one thing never to do is "fix" this test to make an
 * ACCIDENTAL drift pass.
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import * as api from "./index";
// The barrel's source text, inlined at transform time (see `raw-import.d.ts`) — works
// identically under the node and jsdom projects, where a test-time fs read would not
// (jsdom's `import.meta.url` is http-schemed).
import barrelSource from "./index.ts?raw";
// Import every type from the BARREL (not "./types") — resolving these is the REMOVAL/RENAME
// half of the type-surface guard: dropping or renaming a listed barrel type export fails
// `pnpm typecheck`. The ADDITION half cannot be compile-time — a namespace import's type has
// no keys for type-only exports, so no `keyof` can enumerate them — which is why the
// completeness suite below parses the barrel's export statements instead (#157).
import type {
  // color primitives
  OkLCH,
  OkLab,
  RGB,
  Scheme,
  Gamut,
  ColorFormat,
  // engine-rules vocabulary
  LightnessDistribution,
  ChromaPolicy,
  HuePolicy,
  RampRules,
  EngineRules,
  // token/ramp vocabulary
  ThemeTokenName,
  RampLabel,
  RampRole,
  RampStep,
  Ramp,
  RampPair,
  SchemePair,
  SchemeTokens,
  BindingStep,
  StepProvenance,
  FillProvenance,
  FillForegroundProvenance,
  LiteralProvenance,
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
  ContrastCheck,
  ContrastTarget,
  SolveOptions,
  // ramp surface
  RampOptions,
  RampSpec,
  // binding surface
  TokenBinding,
  // harmony palette
  HarmonyKind,
  HarmonyPalette,
  HarmonyOptions,
  // harmony tier (#152) — decorative annex
  HarmonyHue,
  HarmonyStepProvenance,
  HarmonyPick,
  HarmonyHueResult,
  HarmonySchemeResult,
  HarmonyPickPair,
  HarmonyHueTier,
  HarmonyTier,
  HarmonyDesignTokenGroup,
  HarmonyDesignTokensExport,
} from "./index";

/** Every runtime export of `@garden/oklch`, alphabetized. Type-only exports don't exist
 *  at runtime; the signature checks below guard those. */
const RUNTIME_EXPORTS = [
  "CONTRAST_TARGETS",
  "DEFAULT_BINDING_SCHEMA",
  "HARMONY_HUES",
  "HARMONY_KINDS",
  "RAMP_LABELS",
  "RAMP_ROLES",
  "THEME_TOKEN_NAMES",
  "apcaLc",
  "buildHarmonyPalette",
  "buildHarmonyTier",
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
  "harmonyTierToCss",
  "harmonyTierToDesignTokens",
  "harmonyTierToTailwindTheme",
  "inGamut",
  "minPass",
  "oklabToOklch",
  "oklchToLinearRgb",
  "oklchToOklab",
  "oklchToSrgb",
  "parseColor",
  "rampSetToDeclarations",
  "resolveHarmonyTier",
  "resolveTheme",
  "solveForeground",
  "srgbToOklch",
  "tokenSetToDeclarations",
  "tokenSetToDesignTokens",
  "tokenSetToTailwindTheme",
] as const;

const SEMANTIC_NAMES = [
  // Core (14).
  "background",
  "surface",
  "surface-elevated",
  "foreground",
  "muted",
  "muted-foreground",
  "icon",
  "border",
  "accent",
  "accent-text",
  "accent-foreground",
  "accent-subtle",
  "accent-subtle-foreground",
  "ring",
  // Status blocks (×4): fill · fill-foreground · text · subtle · subtle-foreground.
  "error",
  "error-foreground",
  "error-text",
  "error-subtle",
  "error-subtle-foreground",
  "warning",
  "warning-foreground",
  "warning-text",
  "warning-subtle",
  "warning-subtle-foreground",
  "success",
  "success-foreground",
  "success-text",
  "success-subtle",
  "success-subtle-foreground",
  "info",
  "info-foreground",
  "info-text",
  "info-subtle",
  "info-subtle-foreground",
  // Harmony blocks (×7, #334): decorative anchor · fill · text.
  "harmony-analogous-a",
  "harmony-analogous-a-fill",
  "harmony-analogous-a-text",
  "harmony-analogous-b",
  "harmony-analogous-b-fill",
  "harmony-analogous-b-text",
  "harmony-complementary",
  "harmony-complementary-fill",
  "harmony-complementary-text",
  "harmony-triadic-a",
  "harmony-triadic-a-fill",
  "harmony-triadic-a-text",
  "harmony-triadic-b",
  "harmony-triadic-b-fill",
  "harmony-triadic-b-text",
  "harmony-split-complementary-a",
  "harmony-split-complementary-a-fill",
  "harmony-split-complementary-a-text",
  "harmony-split-complementary-b",
  "harmony-split-complementary-b-fill",
  "harmony-split-complementary-b-text",
  // Interaction states (×3) + overlay.
  "accent-hover",
  "surface-hover",
  "surface-selected",
  "scrim",
] as const;

const ROLE_NAMES = [
  "accent",
  "neutral",
  "success",
  "error",
  "warning",
  "info",
  "harmony-analogous-a",
  "harmony-analogous-b",
  "harmony-complementary",
  "harmony-triadic-a",
  "harmony-triadic-b",
  "harmony-split-complementary-a",
  "harmony-split-complementary-b",
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

describe("the guarded public surface (#99)", () => {
  it("exports exactly the guarded runtime names", () => {
    expect(Object.keys(api).sort()).toEqual([...RUNTIME_EXPORTS]);
  });

  it("pins the semantic token names, in emission order", () => {
    expect(api.THEME_TOKEN_NAMES).toEqual(SEMANTIC_NAMES);
  });

  it("pins the ramp roles and the 50…950 step labels", () => {
    expect(api.RAMP_ROLES).toEqual(ROLE_NAMES);
    expect(api.RAMP_LABELS).toEqual(STEP_LABELS);
  });

  it("emits exactly the guarded custom-property names (the CSS surface)", () => {
    const set = api.buildTokenSet("#3b82f6");
    const css = `${api.tokenSetToDeclarations(set)}\n${api.rampSetToDeclarations(set)}`;
    const emitted = [...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]).sort();
    const expected = [
      ...SEMANTIC_NAMES.map((name) => `--${name}`),
      ...ROLE_NAMES.flatMap((role) =>
        STEP_LABELS.map((label) => `--${role}-${label}`),
      ),
    ].sort();
    expect(emitted).toEqual(expected);
  });

  it("pins the high-level signatures", () => {
    expectTypeOf(api.resolveTheme).parameters.toEqualTypeOf<
      [unknown, Scheme, api.EngineOptions?]
    >();
    expectTypeOf(api.resolveTheme).returns.toEqualTypeOf<SchemeResult>();
    expectTypeOf(api.buildTokenSet).parameters.toEqualTypeOf<
      [unknown, api.EngineOptions?]
    >();
    expectTypeOf(api.buildTokenSet).returns.toEqualTypeOf<TokenSet>();
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
 * no-op; the guard is the import list resolving. Adding a public type is ENFORCED, not
 * discipline (#157): the completeness suite below parses the barrel, so a new type export
 * that isn't threaded through the import list, this map, and `PUBLIC_TYPE_EXPORTS` fails.
 */
type PublicTypeSurface = {
  OkLCH: OkLCH;
  OkLab: OkLab;
  RGB: RGB;
  Scheme: Scheme;
  Gamut: Gamut;
  ColorFormat: ColorFormat;
  LightnessDistribution: LightnessDistribution;
  ChromaPolicy: ChromaPolicy;
  HuePolicy: HuePolicy;
  RampRules: RampRules;
  EngineRules: EngineRules;
  ThemeTokenName: ThemeTokenName;
  RampLabel: RampLabel;
  RampRole: RampRole;
  RampStep: RampStep;
  Ramp: Ramp;
  RampPair: RampPair;
  SchemePair: SchemePair;
  SchemeTokens: SchemeTokens;
  BindingStep: BindingStep;
  StepProvenance: StepProvenance;
  FillProvenance: FillProvenance;
  FillForegroundProvenance: FillForegroundProvenance;
  LiteralProvenance: LiteralProvenance;
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
  ContrastCheck: ContrastCheck;
  ContrastTarget: ContrastTarget;
  SolveOptions: SolveOptions;
  RampOptions: RampOptions;
  RampSpec: RampSpec;
  TokenBinding: TokenBinding;
  HarmonyKind: HarmonyKind;
  HarmonyPalette: HarmonyPalette;
  HarmonyOptions: HarmonyOptions;
  HarmonyHue: HarmonyHue;
  HarmonyStepProvenance: HarmonyStepProvenance;
  HarmonyPick: HarmonyPick;
  HarmonyHueResult: HarmonyHueResult;
  HarmonySchemeResult: HarmonySchemeResult;
  HarmonyPickPair: HarmonyPickPair;
  HarmonyHueTier: HarmonyHueTier;
  HarmonyTier: HarmonyTier;
  HarmonyDesignTokenGroup: HarmonyDesignTokenGroup;
  HarmonyDesignTokensExport: HarmonyDesignTokensExport;
};

/** Every type-only export of `@garden/oklch`, alphabetized for readability — the comparison
 *  sorts both sides, so a correct addition can't fail on placement. `satisfies` pins each
 *  entry to a `PublicTypeSurface` key; the completeness suite below pins the list to the
 *  barrel itself. */
const PUBLIC_TYPE_EXPORTS = [
  "BindingPair",
  "BindingProvenance",
  "BindingStep",
  "ChromaPolicy",
  "ColorFormat",
  "ContrastCheck",
  "ContrastTarget",
  "ContrastTargetName",
  "CssOptions",
  "DesignToken",
  "DesignTokenScheme",
  "DesignTokensExport",
  "EngineOptions",
  "EngineRules",
  "ExportOptions",
  "FillForegroundProvenance",
  "FillProvenance",
  "Gamut",
  "HarmonyDesignTokenGroup",
  "HarmonyDesignTokensExport",
  "HarmonyHue",
  "HarmonyHueResult",
  "HarmonyHueTier",
  "HarmonyKind",
  "HarmonyOptions",
  "HarmonyPalette",
  "HarmonyPick",
  "HarmonyPickPair",
  "HarmonySchemeResult",
  "HarmonyStepProvenance",
  "HarmonyTier",
  "HuePolicy",
  "LightnessDistribution",
  "LiteralProvenance",
  "OkLCH",
  "OkLab",
  "RGB",
  "Ramp",
  "RampLabel",
  "RampOptions",
  "RampPair",
  "RampRole",
  "RampRules",
  "RampSpec",
  "RampStep",
  "Scheme",
  "SchemePair",
  "SchemeResult",
  "SchemeTokens",
  "SolveOptions",
  "StepProvenance",
  "ThemeTokenName",
  "TokenBinding",
  "TokenSet",
] as const satisfies readonly (keyof PublicTypeSurface)[];

/**
 * The barrel's exported names, read from its re-export statements (comments stripped).
 * Only `export [type] { … } from "…"` is parsed; any other `export` form throws, so a new
 * export shape cannot slip past unread.
 */
function parseBarrelExports(): { runtime: string[]; types: string[] } {
  const source = barrelSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const reExport = /export(\s+type)?\s*\{([^}]*)\}\s*from\s*"[^"]*";?/g;
  const runtime: string[] = [];
  const types: string[] = [];
  for (const match of source.matchAll(reExport)) {
    const statementIsTypeOnly = match[1] !== undefined;
    for (const specifier of (match[2] ?? "").split(",")) {
      const trimmed = specifier.trim();
      if (trimmed === "") continue;
      const isType = statementIsTypeOnly || /^type\s/.test(trimmed);
      const name = trimmed.replace(/^type\s+/, "").replace(/^\S+\s+as\s+/, "");
      (isType ? types : runtime).push(name);
    }
  }
  if (/\bexport\b/.test(source.replace(reExport, ""))) {
    throw new Error(
      "index.ts contains an export this guard cannot read — only `export [type] { … } from` " +
        "re-exports are parseable; extend the parser in the same commit as the new export form",
    );
  }
  return { runtime, types };
}

describe("guarded public TYPE surface (#99/#157) — completeness", () => {
  const barrel = parseBarrelExports();

  it("the barrel's type exports are exactly the guarded names — a new type fails here until listed", () => {
    expect([...barrel.types].sort()).toEqual([...PUBLIC_TYPE_EXPORTS].sort());
  });

  it("cross-check: the parser's runtime names match the runtime guard's list", () => {
    // Anchors the parser to ground truth — the same names are independently asserted against
    // `Object.keys(api)` above, so a parser that misreads the barrel cannot stay green.
    expect([...barrel.runtime].sort()).toEqual([...RUNTIME_EXPORTS]);
  });

  it("the surface map and the pinned list name the same types", () => {
    // `satisfies` on PUBLIC_TYPE_EXPORTS forbids a name the map lacks; this forbids a map
    // key the list lacks — so the import roll-call, the map, and the list move together.
    expectTypeOf<
      Exclude<keyof PublicTypeSurface, (typeof PUBLIC_TYPE_EXPORTS)[number]>
    >().toEqualTypeOf<never>();
  });
});

describe("the exported derivation contract (#150)", () => {
  it("exposes the named contrast tiers with their WCAG floor + APCA target", () => {
    expect(api.CONTRAST_TARGETS).toEqual({
      bodyText: { wcag: 4.5, apca: 75 },
      mutedText: { wcag: 4.5, apca: 60 },
      accentText: { wcag: 4.5, apca: 60 },
      accentForeground: { wcag: 4.5, apca: 60 },
      ui: { wcag: 3, apca: 45 },
      border: { wcag: 3, apca: 30 },
    });
  });

  it("binds every semantic token — the studio can answer kind/role/target for each", () => {
    // Coverage: exactly the guarded token names, no more, no fewer.
    expect(Object.keys(api.DEFAULT_BINDING_SCHEMA).sort()).toEqual(
      [...api.THEME_TOKEN_NAMES].sort(),
    );
    // Shape: every binding declares a kind the receipt copy switches on.
    for (const name of api.THEME_TOKEN_NAMES) {
      expect([
        "step",
        "anchor",
        "auto",
        "auto-on",
        "literal",
        "fill",
        "fill-foreground",
        "fill-hover",
      ]).toContain(api.DEFAULT_BINDING_SCHEMA[name].kind);
    }
  });

  it("each auto binding's target IS a CONTRAST_TARGETS tier (one source, no restatement)", () => {
    // Identity, not deep-equality: a drifted copy of the table would fail this. This is the
    // single-source guarantee #150 exists to make — the receipt names the solver's own tier.
    const tiers = Object.values(api.CONTRAST_TARGETS);
    for (const name of api.THEME_TOKEN_NAMES) {
      const binding = api.DEFAULT_BINDING_SCHEMA[name];
      if (binding.kind === "auto" || binding.kind === "auto-on") {
        expect(tiers).toContain(binding.target);
      }
    }
  });
});

describe("QA — adversarial: #150 exports are a READ-ONLY contract, not a mutable singleton", () => {
  // #150 asks for the schema "or a READ-ONLY view of it". The solver reads these exact
  // objects at runtime — `resolveTheme` resolves `DEFAULT_BINDING_SCHEMA` directly, and each
  // `auto` binding references a `CONTRAST_TARGETS` tier BY IDENTITY. A `Readonly<…>` type and
  // `as const` are COMPILE-TIME ONLY: they vanish at runtime, leaving a shared, writable
  // singleton every consumer of `@garden/oklch` holds a live reference to. A single stray
  // `CONTRAST_TARGETS.bodyText.wcag = …` (or a schema reassignment) in the Studio — or any
  // other importer — silently corrupts EVERY subsequent solve process-wide. The contract has
  // to be enforced at runtime (`Object.freeze`, deeply), not just described in the types.

  it("CONTRAST_TARGETS is deeply frozen — a stray write cannot corrupt the solver's tiers", () => {
    expect(Object.isFrozen(api.CONTRAST_TARGETS)).toBe(true);
    for (const [name, tier] of Object.entries(api.CONTRAST_TARGETS)) {
      expect(Object.isFrozen(tier), `tier ${name}`).toBe(true);
    }
  });

  it("DEFAULT_BINDING_SCHEMA is deeply frozen — the exported schema cannot be reassigned", () => {
    expect(Object.isFrozen(api.DEFAULT_BINDING_SCHEMA)).toBe(true);
    for (const [name, binding] of Object.entries(api.DEFAULT_BINDING_SCHEMA)) {
      expect(Object.isFrozen(binding), `binding ${name}`).toBe(true);
    }
  });

  it("mutating a CONTRAST_TARGETS tier does NOT corrupt a later solve (proves the shared-singleton risk)", () => {
    // Demonstrates the concrete blast radius: `text` binds `auto` against `bodyText`, so
    // raising that tier's floor at runtime moves the shipped `--foreground` color. Restored in a
    // `finally` so the demonstration can't poison sibling tests — but a frozen table would
    // make the write a silent no-op (loose mode) or throw (strict), and this would pass.
    const tier = api.CONTRAST_TARGETS.bodyText as {
      wcag: number;
      apca: number;
    };
    const before = api.buildTokenSet("#3b82f6").tokens.foreground.light;
    const original = { wcag: tier.wcag, apca: tier.apca };
    // On a deeply-frozen table this write throws in ESM strict mode (or silently no-ops in
    // loose mode) — both mean the tier is immutable. Tolerate the throw so we can still assert
    // the real payload: a later solve is UNCHANGED. The finally restore (also throw-tolerant)
    // keeps a regression from poisoning sibling tests if the freeze ever comes off.
    try {
      try {
        tier.wcag = 21;
        tier.apca = 108;
      } catch {
        /* frozen property → strict-mode TypeError: the immutability we want */
      }
      const after = api.buildTokenSet("#3b82f6").tokens.foreground.light;
      // A read-only contract keeps the solve stable regardless of the attempted write.
      expect(after).toEqual(before);
    } finally {
      try {
        tier.wcag = original.wcag;
        tier.apca = original.apca;
      } catch {
        /* frozen — nothing to restore */
      }
    }
  });
});
