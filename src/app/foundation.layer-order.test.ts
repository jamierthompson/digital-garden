import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The `@layer` statement in foundation.css is load-bearing: it fixes the cascade priority of the
// four layers, lowest-priority FIRST (`components`, declared last, is the strongest of the four —
// component rules must out-rank the foundation reset). `check-css-layers.mjs` only proves every
// rule is INSIDE some
// `@layer` — it is name-agnostic, so it would NOT catch the 4th layer regressing from the #132
// rename (`project` → `components`) nor a reordering. Nothing else pins the literal statement.
// This test is that guard: fail-first if the order string drifts or reverts to `@layer … project`.
// Resolve from the repo root (vitest's cwd); jsdom gives `import.meta.url` a non-file scheme.
const foundationCss = readFileSync(
  resolve(process.cwd(), "src/app/foundation.css"),
  "utf8",
);

describe("foundation.css @layer order statement (#132 rename guard)", () => {
  it("declares the four layers lowest-first: foundation, semantic, brand, components", () => {
    expect(foundationCss).toContain(
      "@layer foundation, semantic, brand, components;",
    );
  });

  it("no longer names the retired 4th layer `project`", () => {
    // The old fourth layer was `@layer … project;`. The rename must have removed it entirely —
    // not just added `components` alongside a surviving `project`.
    expect(/@layer[^;]*\bproject\b[^;]*;/.test(foundationCss)).toBe(false);
  });
});
