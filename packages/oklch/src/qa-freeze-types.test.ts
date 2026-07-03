/**
 * QA (independent, #99): freeze-guard COMPLETENESS for the type-only public surface.
 *
 * `api.test.ts` claims "Type-only exports don't exist at runtime; the signature checks
 * below guard those." That is an overclaim: the `expectTypeOf` signature checks only
 * cover the ~6 types transitively reachable from the checked function signatures. A
 * STANDALONE exported type (e.g. `RampPair`, `SchemeTokens`, `OkLab`, `RampSpec`) can be
 * renamed or removed and `api.test.ts` stays fully green.
 *
 * VERIFIED gap: deleting `export type { RampPair }` from `index.ts` left `api.test.ts`
 * passing (10/10). This file closes that hole — every type the public barrel re-exports
 * is imported here, so dropping or renaming any one of them fails `pnpm typecheck`
 * (a gate step), which is the tripwire the frozen contract needs.
 *
 * If a type is intentionally added to the public surface, add it here in the same commit
 * (mirrors the versioning stance for the runtime freeze list).
 */

import { describe, expectTypeOf, it } from "vitest";

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
  BindingProvenance,
  BindingPair,
  SchemeResult,
  TokenSet,
  // palette options
  EngineOptions,
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

/**
 * A compile-time roll-call of every public type. If any import above disappears, this
 * file fails to type-check → `pnpm typecheck` fails. The runtime body is a no-op; the
 * guard is the import list resolving.
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
  BindingProvenance: BindingProvenance;
  BindingPair: BindingPair;
  SchemeResult: SchemeResult;
  TokenSet: TokenSet;
  EngineOptions: EngineOptions;
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
