/**
 * Co-located test for the color-token immutability guard (scripts/check-color-immutability.mjs).
 *
 * Unlike check-css-layers.test.ts (which shells out because that script has no exportable core),
 * this script exports PURE functions — `parseColorTokenNames`, `detectMutations`,
 * `findColorMutations` — so the detection logic is unit-tested directly. A single happy-path
 * child-process run proves the real (migrated) `src/` tree is clean and the `currentColor`
 * exemptions hold end-to-end.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  detectMutations,
  findColorMutations,
  parseColorTokenNames,
} from "./check-color-immutability.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_SCRIPT = join(HERE, "check-color-immutability.mjs");
const REPO_ROOT = join(HERE, "..");

// A representative slice of the real semantic contract — enough to exercise membership.
const COLOR_TOKENS = new Set([
  "--foreground",
  "--muted-foreground",
  "--accent",
  "--accent-subtle",
  "--muted",
  "--ring",
]);

describe("parseColorTokenNames", () => {
  it("collects every --name: declaration as a token", () => {
    const set = parseColorTokenNames(
      ":root {\n  --foreground: light-dark(a, b);\n  --accent: light-dark(c, d);\n}",
    );
    expect(set.has("--foreground")).toBe(true);
    expect(set.has("--accent")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("ignores commented-out declarations and non-custom properties", () => {
    const set = parseColorTokenNames(
      ":root {\n  color-scheme: light dark;\n  /* --ghost: x; */\n  --border: y;\n}",
    );
    expect(set.has("--border")).toBe(true);
    expect(set.has("--ghost")).toBe(false);
    expect(set.size).toBe(1);
  });
});

describe("detectMutations — color-mix", () => {
  it("flags color-mix referencing a color token", () => {
    const found = detectMutations(
      "color-mix(in oklab, var(--foreground) 65%, transparent)",
      COLOR_TOKENS,
    );
    expect(found).toEqual([{ kind: "color-mix", token: "--foreground" }]);
  });

  it("does NOT flag color-mix on currentColor (not a var / not a token)", () => {
    expect(
      detectMutations(
        "color-mix(in oklab, currentColor 70%, transparent)",
        COLOR_TOKENS,
      ),
    ).toEqual([]);
  });

  it("does NOT flag color-mix on a non-color var (e.g. a space token)", () => {
    expect(
      detectMutations(
        "color-mix(in oklab, var(--space-2) 50%, transparent)",
        COLOR_TOKENS,
      ),
    ).toEqual([]);
  });

  it("flags a color token nested deeper in the mix and reports it once", () => {
    const found = detectMutations(
      "color-mix(in oklab, oklch(from var(--accent) l c h) 5%, transparent)",
      COLOR_TOKENS,
    );
    expect(found).toEqual([{ kind: "color-mix", token: "--accent" }]);
  });
});

describe("detectMutations — slash-alpha", () => {
  it("flags slash-alpha on a color token", () => {
    expect(detectMutations("var(--foreground) / 50%", COLOR_TOKENS)).toEqual([
      { kind: "slash-alpha", token: "--foreground" },
    ]);
  });

  it("does NOT flag slash-alpha on a non-color var", () => {
    expect(detectMutations("var(--space-2) / 2", COLOR_TOKENS)).toEqual([]);
  });

  it("does NOT flag a var() with a comma fallback (no trailing slash-alpha)", () => {
    // `var(--ring, currentColor)` in a focus outline is a fallback, not a mutation.
    expect(
      detectMutations(
        "var(--ring-width) var(--ring-style) var(--ring, currentColor)",
        COLOR_TOKENS,
      ),
    ).toEqual([]);
  });
});

describe("findColorMutations — line reporting across a sheet", () => {
  it("reports the declaration line for each violation", () => {
    const css = [
      "@layer components {",
      "  .a {",
      "    color: color-mix(in oklab, var(--foreground) 65%, transparent);",
      "  }",
      "  .b {",
      "    background: color-mix(in oklab, currentColor 5%, transparent);",
      "  }",
      "}",
    ].join("\n");
    const found = findColorMutations(css, COLOR_TOKENS);
    expect(found).toEqual([
      { line: 3, kind: "color-mix", token: "--foreground" },
    ]);
  });
});

describe("check-color-immutability.mjs — happy path (real, migrated repo)", () => {
  it("exits 0 against the migrated src/ tree (currentColor cases stay exempt)", () => {
    const { status, stdout, stderr } = spawnSync(
      process.execPath,
      [REAL_SCRIPT],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(stderr).not.toMatch(/mutating a solved/);
    expect(stdout).toMatch(/no solved color token is mutated/);
    expect(status).toBe(0);
  });
});
