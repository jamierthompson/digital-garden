import { describe, expect, it } from "vitest";

import {
  rampSetToDeclarations,
  tokenSetToCss,
  tokenSetToDeclarations,
} from "./css";
import { buildTokenSet } from "./palette";
import { formatOklch } from "./convert";

describe("tokenSetToDeclarations", () => {
  const set = buildTokenSet("#3b82f6");
  const decls = tokenSetToDeclarations(set);

  it("sets color-scheme so light-dark() resolves and follows prefers-color-scheme", () => {
    expect(decls).toContain("color-scheme: light dark;");
  });

  it("emits the generic semantic public contract as bare -- names (no ramp tier)", () => {
    expect(decls).toContain("--bg:");
    expect(decls).toContain("--accent:");
    expect(decls).toContain("--focus-ring:");
    // The semantic tier is generic and self-contained: no `--brand-` namespace of any kind
    // (neither a prefixed role nor a ramp primitive — the `--<role>-<step>` ramp tier is a
    // separate opt-in, `rampSetToDeclarations`).
    expect(decls).not.toContain("--brand-");
    // No project-internal alias leaks out of the engine.
    expect(decls).not.toContain("--logx-");
    // color-scheme + exactly the 14 semantic tokens — nothing else.
    expect(decls.split("\n")).toHaveLength(1 + 14);
  });

  it("bakes literal oklch() values inside light-dark()", () => {
    expect(decls).toMatch(
      /--bg: light-dark\(oklch\([^)]+\), oklch\([^)]+\)\);/,
    );
  });
});

describe("rampSetToDeclarations", () => {
  const set = buildTokenSet("#3b82f6");
  const ramps = rampSetToDeclarations(set);

  it("emits the per-role 50…950 ramp primitives baked as light-dark() (#98)", () => {
    // One representative step from each role, plus both ends of a ramp.
    for (const decl of [
      "--brand-50:",
      "--brand-500:",
      "--brand-950:",
      "--neutral-200:",
      "--success-500:",
      "--error-500:",
      "--warning-500:",
      "--info-500:",
    ]) {
      expect(ramps).toContain(decl);
    }
    expect(ramps).toMatch(
      /--brand-500: light-dark\(oklch\([^)]+\), oklch\([^)]+\)\);/,
    );
    // 6 roles × 11 steps — the full primitive tier, no semantic tokens mixed in.
    expect(ramps.split("\n")).toHaveLength(6 * 11);
    expect(ramps).not.toContain("--accent:");
  });

  it("zips each step's LIGHT and DARK literals into light-dark() in the right order", () => {
    // A transposed/duplicated-scheme zip would still match the shape regex above; assert the
    // two literals are exactly the role's light[i] and dark[i] steps for a representative step.
    const { light, dark } = set.ramps.brand;
    const i = light.findIndex((s) => s.label === "500");
    expect(ramps).toContain(
      `--brand-500: light-dark(${formatOklch(light[i].color)}, ${formatOklch(dark[i].color)});`,
    );
  });
});

describe("tokenSetToCss", () => {
  it("wraps the rule in @layer brand for the scoped <style>", () => {
    const css = tokenSetToCss(
      buildTokenSet("#3b82f6"),
      '[data-entry="garden"]',
    );
    expect(css).toContain("@layer brand {");
    expect(css).toContain('[data-entry="garden"] {');
    expect(css).toContain("--text:");
    // The complete scoped rule carries the ramp primitives too (#98).
    expect(css).toContain("--brand-500:");
  });

  it("serializes values per ColorFormat on request, defaulting to native oklch (#99)", () => {
    const set = buildTokenSet("#3b82f6");
    const selector = '[data-entry="garden"]';
    expect(tokenSetToCss(set, selector)).toContain("light-dark(oklch(");
    const hex = tokenSetToCss(set, selector, { format: "hex" });
    expect(hex).toMatch(/--accent: light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\);/);
    expect(hex).not.toContain("oklch(");
  });
});
