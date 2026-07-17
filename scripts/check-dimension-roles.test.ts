/**
 * Co-located test for the dimension-role guard (scripts/check-dimension-roles.mjs). The script
 * exports a PURE detector — `findDimensionViolations` — unit-tested directly; a single
 * child-process run proves the real (migrated) `src/` tree is clean end-to-end.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  findDimensionViolations,
  SPACE_EXEMPT_PREFIXES,
} from "./check-dimension-roles.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_SCRIPT = join(HERE, "check-dimension-roles.mjs");
const REPO_ROOT = join(HERE, "..");

const kinds = (css: string, opts?: { spaceExempt?: boolean }): string[] =>
  findDimensionViolations(css, opts).map((v) => v.kind);

describe("findDimensionViolations", () => {
  it("flags a raw --space-<N> read in a normal declaration", () => {
    expect(kinds(".a { margin-top: var(--space-4); }")).toEqual(["raw-space"]);
  });

  it("passes a semantic space role", () => {
    expect(kinds(".a { margin: var(--space-flow) 0; }")).toEqual([]);
  });

  it("allows a component-token DEFINITION to bind the foundation scale", () => {
    expect(kinds(".a { --quote-indent: var(--space-4); }")).toEqual([]);
    // …but a normal declaration still can't read the raw step directly.
    expect(
      kinds(".a { --x: var(--space-4); padding: var(--space-4); }"),
    ).toEqual(["raw-space"]);
  });

  it("flags the radius knob and every retired scale name; passes the roles", () => {
    expect(kinds(".a { border-radius: var(--radius-base); }")).toEqual([
      "raw-radius",
    ]);
    expect(kinds(".a { border-radius: var(--radius-md); }")).toEqual([
      "raw-radius",
    ]);
    expect(kinds(".a { border-radius: var(--radius-full); }")).toEqual([
      "raw-radius",
    ]);
    expect(kinds(".a { border-radius: var(--radius-surface); }")).toEqual([]);
    expect(kinds(".a { border-radius: var(--radius-pill); }")).toEqual([]);
  });

  it("flags a hardcoded ch measure; passes a measure token", () => {
    expect(kinds(".a { max-width: 64ch; }")).toEqual(["ch-literal"]);
    expect(kinds(".a { max-width: var(--type-body-measure); }")).toEqual([]);
  });

  it("honors the space exemption without loosening radius/measure rules", () => {
    const css =
      ".a { padding: var(--space-4); border-radius: var(--radius-md); }";
    expect(kinds(css, { spaceExempt: true })).toEqual(["raw-radius"]);
  });

  it("reports accurate line numbers and skips comments", () => {
    const css =
      "/* var(--space-4) in a comment */\n.a {\n  gap: var(--space-2);\n}";
    const v = findDimensionViolations(css);
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(3);
  });
});

/**
 * QA — the guard is a regex over each declaration VALUE, so it must catch every spelling the
 * CSS engine accepts, not just the canonical one. Each DEFECT case below is valid CSS a
 * browser resolves to the forbidden primitive, yet the guard passes it silently today.
 */
describe("adversarial QA — spellings the CSS engine accepts must not slip the guard", () => {
  it("still catches the canonical evasions that DO hold", () => {
    // Nested-in-fallback and inside calc() are covered — pin them so a fix for the
    // case-insensitivity holes doesn't regress the substring matching.
    expect(kinds(".a { padding: var(--x, var(--space-4)); }")).toEqual([
      "raw-space",
    ]);
    expect(kinds(".a { width: calc(100% - 65ch); }")).toEqual(["ch-literal"]);
  });

  // CSS function-name matching is ASCII case-insensitive (CSS Syntax, ident matching), so
  // `VAR(--space-4)` reads the raw step in every browser — the guard matches what the engine
  // resolves, not one canonical spelling (QA D1).
  it("flags a case-varied function name — VAR()/Var() read the primitive in every browser", () => {
    expect(kinds(".a { padding: VAR(--space-4); }")).toEqual(["raw-space"]);
    expect(kinds(".a { border-radius: Var(--radius-base); }")).toEqual([
      "raw-radius",
    ]);
  });

  // CSS units are case-insensitive too: `65CH` is the same length as `65ch` (QA D1).
  it("flags a case-varied ch unit — 65CH is the same hardcoded measure", () => {
    expect(kinds(".a { max-width: 65CH; }")).toEqual(["ch-literal"]);
  });

  // Comments are valid anywhere whitespace is (CSS Syntax, tokenization), so
  // `var(/**/--space-4)` resolves normally — the detector strips comments before matching
  // (QA D1).
  it("flags a comment wedged inside var() — var(/**/--space-4) still reads the raw step", () => {
    expect(kinds(".a { padding: var(/**/--space-4); }")).toEqual(["raw-space"]);
    expect(kinds(".a { border-radius: var(/**/--radius-md); }")).toEqual([
      "raw-radius",
    ]);
  });

  // A negative ch literal (e.g. a hanging-indent `text-indent: -2ch`) is preceded
  // by `-`, which the CH_LITERAL prefix class must admit (QA D1).
  it("flags a negative ch literal — -2ch is still a hardcoded measure", () => {
    expect(kinds(".a { text-indent: -2ch; }")).toEqual(["ch-literal"]);
  });
});

describe("the exemption list", () => {
  it("names only the surfaces with pending design passes", () => {
    expect(SPACE_EXEMPT_PREFIXES).toEqual([
      "src/components/page-chrome/",
      "src/app/[slug]/states.module.css",
      "src/app/loading.module.css",
    ]);
  });
});

describe("the real tree", () => {
  it("is clean end-to-end (the migration actually landed)", () => {
    const run = spawnSync(process.execPath, [REAL_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(run.status, run.stderr).toBe(0);
  });
});
