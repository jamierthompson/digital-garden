/**
 * Co-located test for the CSS cascade-layer regression guard (scripts/check-css-layers.mjs).
 *
 * Unlike check-retired-citations.mjs, this script has NO argv override — it always scans
 * a hardcoded `../src` relative to its OWN file location (`new URL("../src", import.meta.url)`).
 * To exercise it against throwaway fixtures without touching the real `src/` tree, each test
 * copies the (unmodified) script into a scratch `scripts/` + `src/` pair nested INSIDE this
 * repo (so bare-specifier `postcss` resolution still finds the real `node_modules` by walking
 * up parent directories) and runs the copy as a child process.
 *
 * Runs the script as a child process and asserts on exit code + output — never imports it
 * (the script calls process.exit).
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_SCRIPT = join(HERE, "check-css-layers.mjs");
const REPO_ROOT = join(HERE, "..");

const scratchDirs: string[] = [];

afterEach(() => {
  for (const d of scratchDirs.splice(0))
    rmSync(d, { recursive: true, force: true });
});

/**
 * Builds a scratch `<tmp>/scripts/check-css-layers.mjs` + `<tmp>/src/**` tree nested under
 * the repo root, copies the real script in unmodified, writes the given fixture CSS files
 * under `<tmp>/src/`, and runs the copy. `files` keys are paths relative to `src/`.
 */
function run(files: Record<string, string>) {
  const tmp = mkdtempSync(join(REPO_ROOT, ".qa-css-layers-"));
  scratchDirs.push(tmp);

  const scriptsDir = join(tmp, "scripts");
  const srcDir = join(tmp, "src");
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(srcDir, { recursive: true });
  copyFileSync(REAL_SCRIPT, join(scriptsDir, "check-css-layers.mjs"));

  for (const [relPath, body] of Object.entries(files)) {
    const full = join(srcDir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }

  return spawnSync(
    process.execPath,
    [join(scriptsDir, "check-css-layers.mjs")],
    {
      cwd: tmp,
      encoding: "utf8",
    },
  );
}

describe("check-css-layers.mjs — happy path (real repo)", () => {
  it("passes with exit 0 against the real src/ tree", () => {
    const { status, stdout, stderr } = spawnSync(
      process.execPath,
      [REAL_SCRIPT],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(stderr).not.toMatch(/outside an @layer/);
    expect(stdout).toMatch(/all rules .* are layered/);
    expect(status).toBe(0);
  });
});

describe("check-css-layers.mjs — global sheets", () => {
  it("FAILS on a bare top-level rule in a global (non-module) sheet", () => {
    const { status, stderr } = run({
      "globals.css": ".foo {\n  color: red;\n}\n",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/outside an @layer block/);
    expect(stderr).toMatch(/globals\.css:1\s+"\.foo"/);
  });

  it("PASSES a correctly layered global sheet (mirrors the base token sheets)", () => {
    const { status, stdout } = run({
      "foundation.css": [
        "@layer base, components;",
        "",
        "@layer base {",
        "  :root {",
        "    --space-1: 0.25rem;",
        "  }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/all rules .* are layered/);
  });

  it("PASSES the bare `@layer base, components;` statement form (no block) alongside a layered rule", () => {
    const { status, stdout } = run({
      "globals.css": [
        "@layer base, components;",
        "",
        "@layer base {",
        "  .foo { color: red; }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/all rules .* are layered/);
  });

  it("FAILS a global sheet whose @layer name is outside {base, components}", () => {
    const { status, stderr } = run({
      "globals.css": [
        "@layer legacy {",
        "  .foo { color: red; }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/name outside \{base, components\}/);
    expect(stderr).toMatch(/globals\.css:1\s+@layer "legacy"/);
  });

  it("FAILS a bare top-level `:root` block (not just class selectors)", () => {
    const { status, stderr } = run({
      "globals.css": ":root {\n  --x: 1;\n}\n",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/:root"/);
  });
});

// QA (adversarial, #254): prove the two-name enforcement holds against every form a stray
// layer name can arrive in — statement lists, nested blocks, casing — and pin the anonymous
// exemption. These lock the collapse against a silent regression to three names.
describe("check-css-layers.mjs — @layer name enforcement edges (QA #254)", () => {
  it("FAILS a multi-name statement that mixes an allowed name with a stray (`@layer base, legacy;`)", () => {
    // The stray must be caught even when a valid name sits beside it in the same statement —
    // otherwise a retired name re-enters the order statement unnoticed.
    const { status, stderr } = run({
      "globals.css": [
        "@layer base, legacy;",
        "",
        "@layer base { .a { color: red; } }",
        "",
      ].join("\n"),
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/name outside \{base, components\}/);
    expect(stderr).toMatch(/@layer "legacy"/);
  });

  it("FAILS a stray name on the INNER of a nested `@layer` block", () => {
    const { status, stderr } = run({
      "globals.css": [
        "@layer base {",
        "  @layer legacy {",
        "    .a { color: red; }",
        "  }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/@layer "legacy"/);
  });

  it("FAILS a case-mismatched name (`@layer Base`) — CSS layer names are case-sensitive", () => {
    const { status, stderr } = run({
      "globals.css": "@layer Base { .a { color: red; } }\n",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/@layer "Base"/);
  });

  it("PASSES an anonymous layer block (`@layer { … }`) — empty params are a valid, exempt form", () => {
    const { status, stdout } = run({
      "globals.css": "@layer { .a { color: red; } }\n",
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/all rules .* are layered/);
  });

  it("FAILS each retired cascade-layer name individually (foundation/semantic/brand/project)", () => {
    for (const name of ["foundation", "semantic", "brand", "project"]) {
      const { status, stderr } = run({
        "globals.css": `@layer ${name} { .a { color: red; } }\n`,
      });
      expect(status, `retired name "${name}" slipped past the guard`).toBe(1);
      expect(stderr).toMatch(new RegExp(`@layer "${name}"`));
    }
  });

  it("flags a retired layer name carried on `@import … layer(name)`", () => {
    // `@import "x.css" layer(foundation);` assigns an imported sheet to a cascade layer (CSS
    // Cascading & Inheritance L5) — a second route by which a retired name can re-enter the
    // cascade, besides an `@layer` at-rule. The guard walks `@import`'s `layer()` function too,
    // so this form is caught. Defense-in-depth: the repo imports CSS via JS side-effects today,
    // not `@import`, but the guard's contract ("enforce the exact two names") holds for every form.
    const { status } = run({
      "globals.css": [
        '@import "x.css" layer(foundation);',
        "@layer base { .a { color: red; } }",
        "",
      ].join("\n"),
    });
    expect(status).toBe(1);
  });
});

describe("check-css-layers.mjs — @media / @supports nesting", () => {
  it("PASSES a rule nested in @media that is itself inside @layer", () => {
    const { status } = run({
      "globals.css": [
        "@layer base {",
        "  @media (min-width: 100px) {",
        "    .bar { color: blue; }",
        "  }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(0);
  });

  it("FAILS a rule nested in a bare @media with NO enclosing @layer", () => {
    // An unlayered rule under @media is just as unlayered as one at the top level — @media
    // does not itself establish a layer, so it must still out-rank every @layer style. This
    // locks down that the guard treats @media as transparent, not as an exemption.
    const { status, stderr } = run({
      "globals.css": [
        "@media (min-width: 100px) {",
        "  .foo { color: red; }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/"\.foo"/);
  });

  it("FAILS a rule nested in a bare @supports with NO enclosing @layer", () => {
    const { status, stderr } = run({
      "globals.css": [
        "@supports (display: grid) {",
        "  .foo { display: grid; }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/"\.foo"/);
  });

  it("PASSES a rule nested in @supports that is itself inside @layer", () => {
    const { status } = run({
      "globals.css": [
        "@layer base {",
        "  @supports (display: grid) {",
        "    .foo { display: grid; }",
        "  }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(0);
  });
});

describe("check-css-layers.mjs — at-rules the selector walker misidentifies", () => {
  it("exempts unlayered @keyframes offset selectors (from/to/N%)", () => {
    // postcss parses `@keyframes` offsets (`from`, `to`, `0%`) as generic Rule nodes with no
    // special-casing, so a naive walker would treat an idiomatic, unlayered `@keyframes` block
    // (the near-universal norm — almost nobody wraps animation keyframes in a cascade layer) as
    // bare style rules needing `@layer`. The checker exempts any rule whose parent at-rule is
    // `@keyframes` (or a vendor-prefixed variant), so `from`/`to`/`N%` never false-positive.
    const { status, stderr } = run({
      "globals.css": [
        "@keyframes spin {",
        "  from { transform: rotate(0deg); }",
        "  to { transform: rotate(360deg); }",
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(0);
    expect(stderr).toBe("");
  });

  it("PASSES a bare @font-face block (declarations only, no Rule nodes to walk)", () => {
    const { status, stdout } = run({
      "globals.css": [
        "@font-face {",
        '  font-family: "Test";',
        '  src: url("./t.woff2") format("woff2");',
        "}",
        "",
      ].join("\n"),
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/all rules .* are layered/);
  });
});

describe("check-css-layers.mjs — file discovery & scope", () => {
  it("still flags a bare rule in a *.module.css file (pre-existing behavior)", () => {
    const { status, stderr } = run({
      "components/Foo.module.css": ".root { color: green; }\n",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/Foo\.module\.css:1\s+"\.root"/);
  });

  it("recurses into nested directories and reports the correct relative path", () => {
    const { status, stderr } = run({
      "components/deep/nested/Thing.module.css": ".x { color: red; }\n",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/components\/deep\/nested\/Thing\.module\.css:1/);
  });

  it("ignores non-.css files entirely (e.g. .scss is out of scope)", () => {
    const { status, stdout } = run({
      "legacy.scss": ".foo { color: red; }\n",
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/all rules .* are layered/);
  });

  it("does not crash on an empty .css file", () => {
    const { status, stdout } = run({ "empty.css": "" });
    expect(status).toBe(0);
    expect(stdout).toMatch(/all rules .* are layered/);
  });

  it("reports every violation across multiple files, not just the first", () => {
    const { status, stderr } = run({
      "globals.css": ".a { color: red; }\n",
      "components/Bar.module.css": ".b { color: blue; }\n",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/"\.a"/);
    expect(stderr).toMatch(/"\.b"/);
    expect(stderr).toMatch(/2 violation\(s\)/);
  });
});

// #257: within the single `base` layer the winner is decided by SHEET IMPORT ORDER, not tier,
// so two base sheets that set the same (selector, property) are one reorder from silently
// flipping. These pin that cross-sheet collisions fail while the legitimate patterns (different
// properties on a shared `:root`, same-file duplicates, the components layer) stay green.
describe("check-css-layers.mjs — base-layer cross-sheet property disjointness (#257)", () => {
  it("FAILS when two base sheets set the same property on the same selector", () => {
    const { status, stderr } = run({
      "styles/foundation/a.css": "@layer base { :root { --x: 1; } }\n",
      "styles/semantic/b.css": "@layer base { :root { --x: 2; } }\n",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/property collision across sheets/);
    // Names both offending sheets and the colliding (selector, property).
    expect(stderr).toMatch(/":root" \{ --x \}/);
    expect(stderr).toMatch(/styles\/foundation\/a\.css/);
    expect(stderr).toMatch(/styles\/semantic\/b\.css/);
  });

  it("PASSES two base sheets that set DIFFERENT properties on a shared :root (the real token pattern)", () => {
    // foundation/* and semantic/* both write `:root`, but each owns distinct custom properties —
    // the intended architecture, which must not trip the guard.
    const { status, stdout } = run({
      "styles/foundation/a.css": "@layer base { :root { --space-1: 1px; } }\n",
      "styles/semantic/b.css": "@layer base { :root { --surface: red; } }\n",
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/property-disjoint/);
  });

  it("PASSES a same-FILE duplicate (author-visible source order, not silent cross-sheet drift)", () => {
    const { status } = run({
      "styles/foundation/a.css":
        "@layer base { :root { --x: 1; } :root { --x: 2; } }\n",
    });
    expect(status).toBe(0);
  });

  it("PASSES the same property on DIFFERENT selectors across base sheets", () => {
    const { status } = run({
      "styles/foundation/a.css": "@layer base { .a { color: red; } }\n",
      "styles/semantic/b.css": "@layer base { .b { color: blue; } }\n",
    });
    expect(status).toBe(0);
  });

  it("does NOT flag a collision in the components layer — only base sheets are guarded", () => {
    // CSS Modules hash their class names, so cross-module same-selector collisions are
    // structurally impossible and intended to be independent; the guard is base-only.
    const { status } = run({
      "components/A.module.css":
        "@layer components { .root { color: red; } }\n",
      "components/B.module.css":
        "@layer components { .root { color: blue; } }\n",
    });
    expect(status).toBe(0);
  });

  it("normalizes selector lists — `:root, .x` collides with `:root` on a shared property", () => {
    const { status, stderr } = run({
      "styles/foundation/a.css": "@layer base { :root, .x { --x: 1; } }\n",
      "styles/semantic/b.css": "@layer base { :root { --x: 2; } }\n",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/":root" \{ --x \}/);
  });

  it("folds case for a STANDARD property (`COLOR` collides with `color`)", () => {
    const { status } = run({
      "styles/foundation/a.css": "@layer base { .a { COLOR: red; } }\n",
      "styles/semantic/b.css": "@layer base { .a { color: blue; } }\n",
    });
    expect(status).toBe(1);
  });

  it("keeps case for a CUSTOM property (`--Foo` does NOT collide with `--foo`)", () => {
    // Custom property names are case-sensitive per CSS Variables — `--Foo` and `--foo` are
    // distinct properties, so this is not a collision.
    const { status } = run({
      "styles/foundation/a.css": "@layer base { :root { --Foo: 1; } }\n",
      "styles/semantic/b.css": "@layer base { :root { --foo: 2; } }\n",
    });
    expect(status).toBe(0);
  });

  // QA (adversarial, #257 round): pin the report contract byte-for-byte and the guard's edge
  // semantics — at-rule transparency, list splitting inside quoted values, pair expansion —
  // plus the two accepted comparison gaps, so any future change to them is deliberate.
  describe("QA — report contract & normalization edges", () => {
    it("reports the exact `(selector, property, sheetA:line, sheetB:line)` collision line", () => {
      // Multi-line fixtures so the declaration lines differ from 1 — a report that printed
      // the RULE's line (or a hardcoded 1) instead of each declaration's would slip past
      // the looser path-only assertions above.
      const { status, stderr } = run({
        "styles/foundation/a.css": [
          "@layer base {",
          "  :root {",
          "    --y: 0;",
          "    --x: 1;",
          "  }",
          "}",
          "",
        ].join("\n"),
        "styles/semantic/b.css": [
          "@layer base {",
          "  :root {",
          "    --x: 2;",
          "  }",
          "}",
          "",
        ].join("\n"),
      });
      expect(status).toBe(1);
      expect(stderr).toContain(
        '":root" { --x }  src/styles/foundation/a.css:4  src/styles/semantic/b.css:3',
      );
      expect(stderr).toMatch(/1 violation\(s\)/);
    });

    it("catches a collision arriving via a selector-LIST member on a standard property", () => {
      // The real reset.css declares `font-family` on a bare `body`; a future sheet writing
      // `html, body { font-family: … }` collides only through the split list member.
      const { status, stderr } = run({
        "reset.css": "@layer base { body { font-family: serif; } }\n",
        "styles/semantic/typography.css": [
          "@layer base {",
          "  html,",
          "  body {",
          "    font-family: sans-serif;",
          "  }",
          "}",
          "",
        ].join("\n"),
      });
      expect(status).toBe(1);
      expect(stderr).toMatch(/"body" \{ font-family \}/);
      // `html` sets font-family in only one sheet — it must NOT be reported.
      expect(stderr).not.toMatch(/"html" \{ font-family \}/);
    });

    it("flags a cross-sheet duplicate even under mutually exclusive @media contexts (conservative by design)", () => {
      // The key is (selector, property) only — @media/@supports context is not tracked. When
      // both queries CAN match, source order still decides, so flagging is correct; for
      // mutually exclusive queries this is a knowing false positive, accepted as cheaper than
      // at-rule-context tracking. A future need for cross-sheet responsive overrides must
      // change this deliberately.
      const { status, stderr } = run({
        "styles/foundation/a.css":
          "@layer base { @media (max-width: 599px) { :root { --x: 1; } } }\n",
        "styles/semantic/b.css":
          "@layer base { @media (min-width: 600px) { :root { --x: 2; } } }\n",
      });
      expect(status).toBe(1);
      expect(stderr).toMatch(/":root" \{ --x \}/);
    });

    it("does NOT split a selector list at a comma inside a quoted attribute value", () => {
      // `[data-x="a,b"]` is ONE selector; the depth-tracking split must not halve it. The
      // collision report carries the selector intact.
      const { status, stderr } = run({
        "styles/foundation/a.css":
          '@layer base { [data-x="a,b"] { color: red; } }\n',
        "styles/semantic/b.css":
          '@layer base { [data-x="a,b"] { color: blue; } }\n',
      });
      expect(status).toBe(1);
      expect(stderr).toContain('"[data-x="a,b"]" { color }');
    });

    it("reports every colliding PAIR when three sheets share a (selector, property)", () => {
      const { status, stderr } = run({
        "styles/foundation/a.css": "@layer base { :root { --x: 1; } }\n",
        "styles/foundation/b.css": "@layer base { :root { --x: 2; } }\n",
        "styles/semantic/c.css": "@layer base { :root { --x: 3; } }\n",
      });
      expect(status).toBe(1);
      // 3 sheets → C(3,2) = 3 pairs, so each offending sheet is named against each other.
      expect(stderr).toMatch(/3 violation\(s\)/);
    });

    it("accepts combinator-whitespace variants (`.a > .b` vs `.a>.b`) — a known gap Prettier closes", () => {
      // These are the SAME selector (identical specificity and matches), so a cross-sheet
      // duplicate IS order-dependent — but whitespace normalization only collapses runs, it
      // does not strip spaces around combinators. Accepted because `pnpm format:check` gates
      // every sheet and Prettier canonicalizes combinators to `.a > .b`, so both files can
      // only ever reach the guard in the same form.
      const { status } = run({
        "styles/foundation/a.css": "@layer base { .a > .b { color: red; } }\n",
        "styles/semantic/b.css": "@layer base { .a>.b { color: blue; } }\n",
      });
      expect(status).toBe(0);
    });

    it("compares selector text verbatim — element-selector case (`BODY` vs `body`) is not folded", () => {
      // Element selectors match case-insensitively against HTML, so this is a theoretical
      // false negative; pinned so a future case-folding change is deliberate, not accidental.
      const { status } = run({
        "styles/foundation/a.css": "@layer base { BODY { color: red; } }\n",
        "styles/semantic/b.css": "@layer base { body { color: blue; } }\n",
      });
      expect(status).toBe(0);
    });
  });
});

describe("check-css-layers.mjs — malformed input", () => {
  it("exits non-zero on unparsable CSS rather than silently passing", () => {
    // postcss.parse() is not wrapped in try/catch, so a syntax error throws a raw
    // CssSyntaxError with a Node stack trace instead of the script's clean violation
    // format. It DOES still fail the gate (uncaught exceptions exit 1), so this isn't a
    // silent-pass bug — but the output is a leaking internal stack trace, not the intended
    // diagnostic. Documented here so a future change to swallow parse errors (silent 0) is
    // caught.
    const { status, stderr } = run({
      "broken.css": ".foo {\n  color: red;\n",
    });
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/CssSyntaxError|Unclosed block/);
  });
});
