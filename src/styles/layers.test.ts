import { execFileSync } from "node:child_process";
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

// QA (adversarial, #254): the collapse to `base, components` is only complete if NO retired
// cascade-layer name survives anywhere in `src/` — not just the CSS sheets the per-sheet tests
// pin, but code comments too. A stale `@layer foundation, semantic, components` comment is rot
// the moment layers.css changed; one (layout.tsx) is a LOAD-BEARING import-order comment. The
// token-tier words "foundation"/"semantic" stay legal in prose; only retired names in an `@layer`
// *cascade* position are the target — matched by requiring `@layer` before them.
describe("retired @layer cascade name in src source (QA #254)", () => {
  const ROOT = process.cwd();
  // Only these two files may mention a retired name in an `@layer` position: they assert
  // ABOUT the retired names (this guard's own regex + reset.test.ts's negative pin). A
  // blanket test-file exclusion would let stale prose comments rot in every other test.
  const ALLOWLIST = new Set([
    "src/styles/layers.test.ts",
    "src/styles/reset.test.ts",
  ]);
  const SRC_FILES = execFileSync(
    "git",
    ["ls-files", "src/**/*.ts", "src/**/*.tsx", "src/**/*.css"],
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter((p) => p && !ALLOWLIST.has(p));
  const RETIRED_LAYER_RE =
    /@layer`?[ ]+[a-z`, ]*\b(foundation|semantic|brand|project)\b/;
  it("no src file references a retired cascade `@layer` name (code or comment)", () => {
    const offenders = [];
    for (const rel of SRC_FILES) {
      const body = readFileSync(resolve(ROOT, rel), "utf8");
      const m = body.match(RETIRED_LAYER_RE);
      if (m) offenders.push(`${rel}: "${m[0].trim()}"`);
    }
    expect(
      offenders,
      `retired @layer names survive:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
