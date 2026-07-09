import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The `@layer` statement fixes cascade priority lowest-first (`components` strongest).
 * `check-css-layers.mjs` only proves every rule is INSIDE some layer — it can't catch a reordering
 * or a stray `brand`/`project` layer, so pin the statement here.
 */
const SHEET = readFileSync(
  resolve(process.cwd(), "src/styles/layers.css"),
  "utf8",
);

describe("layers.css @layer order statement", () => {
  it("declares the three layers lowest-first: foundation, semantic, components", () => {
    expect(SHEET).toContain("@layer foundation, semantic, components;");
  });

  it("excludes the `brand` and `project` layers", () => {
    expect(/@layer[^{;]*\bbrand\b/.test(SHEET)).toBe(false);
    expect(/@layer[^{;]*\bproject\b/.test(SHEET)).toBe(false);
  });
});
