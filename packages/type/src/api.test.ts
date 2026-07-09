/**
 * The public-surface DRIFT GUARD (mirrors `@garden/oklch`'s `api.test.ts`). The engine's exported
 * names — its runtime exports and the `--type-size-<n>` custom properties the serializer emits —
 * are the surface `foundation/typography.css`'s baked tokens and its guard test depend on.
 *
 * `@garden/type` is internal and single-consumer, so this surface is FREELY changeable — the test
 * is a tripwire against SILENT drift, not a wall. A failure means the surface changed: that is fine
 * as a DELIBERATE decision (add the name here in the same commit; migrate consumers in the same PR).
 * The one thing never to do is "fix" this test to make an ACCIDENTAL drift pass.
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import * as api from "./index";
// Import every type from the BARREL so a dropped `export type { … }` fails `pnpm typecheck` here
// (the runtime checks below only reach types named in the checked signatures).
import type { ScaleConfig, FluidStep, TypeScale, TypeScaleMeta } from "./index";

describe("public runtime surface", () => {
  it("exports exactly the expected names", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "DEFAULT_CONFIG",
        "ZOOM_CAP_RATIO",
        "buildTypeScale",
        "fluidClampString",
        "modularSize",
        "sizeVarName",
        "solveStep",
        "typeScaleToCss",
        "typeScaleToDeclarations",
      ].sort(),
    );
  });

  it("pins the zoom cap at 2.4 (margin under the 2.5 theoretical limit)", () => {
    expect(api.ZOOM_CAP_RATIO).toBe(2.4);
  });

  it("emits the --type-size-<n> custom-property namespace (numeric ramp, not roles)", () => {
    expect(api.sizeVarName(1)).toBe("--type-size-1");
    expect(api.sizeVarName(8)).toBe("--type-size-8");
  });
});

describe("public type surface", () => {
  it("keeps the checked function signatures", () => {
    expectTypeOf(api.buildTypeScale).toBeCallableWith();
    expectTypeOf(api.buildTypeScale).returns.toEqualTypeOf<TypeScale>();
    expectTypeOf(api.typeScaleToDeclarations).parameters.toEqualTypeOf<
      [TypeScale]
    >();
    expectTypeOf(api.solveStep).returns.toEqualTypeOf<FluidStep>();
  });

  it("names the vocabulary types (resolving them here guards against a barrel drop)", () => {
    expectTypeOf<ScaleConfig["stepCount"]>().toEqualTypeOf<number>();
    expectTypeOf<ScaleConfig["baseIndex"]>().toEqualTypeOf<number>();
    expectTypeOf<TypeScale["steps"]>().toEqualTypeOf<readonly FluidStep[]>();
    expectTypeOf<TypeScale["meta"]>().toEqualTypeOf<TypeScaleMeta>();
    expectTypeOf<FluidStep["zoomCapped"]>().toEqualTypeOf<boolean>();
  });
});
