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

  it("DEFECT: a retired name reintroduced via `@import … layer(name)` is NOT caught", () => {
    // `@import "x.css" layer(foundation);` is the spec'd way to assign an imported sheet to a
    // cascade layer (CSS Cascading & Inheritance L5). The guard only walks `@layer` at-rules,
    // so the layer NAME carried on an `@import`'s `layer()` function slips through — a retired
    // name can re-enter the cascade this way with no gate failure. This assertion encodes the
    // EXPECTED behavior (catch it) and currently FAILS, proving the enforcement gap. The repo
    // imports CSS via JS side-effects today, so this is defense-in-depth, not an active break —
    // but the guard's stated contract ("enforce the exact two names") does not hold for this form.
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
  it("DEFECT: flags unlayered @keyframes offset selectors (from/to/N%) as bare rules", () => {
    // postcss parses `@keyframes` offsets (`from`, `to`, `0%`) as generic Rule nodes with no
    // special-casing. The walker therefore treats a completely idiomatic, unlayered
    // `@keyframes` block (the overwhelming norm — almost nobody wraps animation keyframes in
    // a cascade layer) as if `from`/`to` were CSS selectors that need @layer wrapping, and
    // reports them with a confusing message ("from"/"to" look nothing like a violating
    // selector to a developer reading the output).
    //
    // This assertion encodes the EXPECTED behavior (keyframe offsets are exempt) and
    // currently FAILS against the real script — proving the false positive. See the QA
    // report for the recommended fix (skip rules whose parent atrule is `keyframes`).
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
