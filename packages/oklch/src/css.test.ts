import { describe, expect, it } from "vitest";

import { tokenSetToCss, tokenSetToDeclarations } from "./css";
import { buildTokenSet } from "./palette";

describe("tokenSetToDeclarations", () => {
  const set = buildTokenSet("#3b82f6");
  const decls = tokenSetToDeclarations(set);

  it("sets color-scheme so light-dark() resolves and follows prefers-color-scheme", () => {
    expect(decls).toContain("color-scheme: light dark;");
  });

  it("emits the generic --brand-* public contract", () => {
    expect(decls).toContain("--brand-bg:");
    expect(decls).toContain("--brand-accent:");
    expect(decls).toContain("--brand-focus-ring:");
    // No project-internal alias leaks out of the engine.
    expect(decls).not.toContain("--logx-");
  });

  it("bakes literal oklch() values inside light-dark()", () => {
    expect(decls).toMatch(
      /--brand-bg: light-dark\(oklch\([^)]+\), oklch\([^)]+\)\);/,
    );
  });
});

describe("tokenSetToCss", () => {
  it("wraps the rule in @layer brand for the scoped <style>", () => {
    const css = tokenSetToCss(
      buildTokenSet("#3b82f6"),
      '[data-project="garden"]',
    );
    expect(css).toContain("@layer brand {");
    expect(css).toContain('[data-project="garden"] {');
    expect(css).toContain("--brand-text:");
  });
});
