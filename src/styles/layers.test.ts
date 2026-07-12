import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The `@layer` statement fixes cascade priority lowest-first (`components` strongest).
 * `check-css-layers.mjs` proves every rule is inside a layer named from the allowed set, but not the
 * relative ORDER of those names — so pin the statement itself here.
 */
const SHEET = readFileSync(
  resolve(process.cwd(), "src/styles/layers.css"),
  "utf8",
);

describe("layers.css @layer order statement", () => {
  it("declares the two layers lowest-first: base, components", () => {
    expect(SHEET).toContain("@layer base, components;");
  });

  it("carries no retired layer name (foundation/semantic/brand/project)", () => {
    for (const name of ["foundation", "semantic", "brand", "project"]) {
      expect(
        new RegExp(`@layer[^{;]*\\b${name}\\b`).test(SHEET),
        `retired @layer name "${name}" still present`,
      ).toBe(false);
    }
  });
});
