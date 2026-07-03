/**
 * Co-located test for the retired-citation regression guard
 * (scripts/check-retired-citations.mjs).
 *
 * Runs the script as a child process and asserts on exit code + output — never imports it
 * (the script calls process.exit). The happy path proves the real repo has zero retired
 * `[D#]`/`§N` citations left; the detection cases pass throwaway fixture files as argv
 * (mirroring check-doc-links.mjs's argv override) so the real tracked source stays
 * untouched.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "check-retired-citations.mjs");

function run(fileArgs: string[] = []) {
  return spawnSync(process.execPath, [SCRIPT, ...fileArgs], {
    encoding: "utf8",
  });
}

describe("check-retired-citations.mjs — happy path (real repo)", () => {
  it("passes with exit 0 — no retired citations left in tracked docs/comments", () => {
    const { status, stdout, stderr } = run();
    expect(stderr).not.toMatch(/FAIL/);
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });
});

describe("check-retired-citations.mjs — detection (fixtures)", () => {
  const dirs: string[] = [];

  function fixture(files: Record<string, string>): Record<string, string> {
    const base = mkdtempSync(join(tmpdir(), "retired-citations-"));
    dirs.push(base);
    const paths: Record<string, string> = {};
    for (const [name, body] of Object.entries(files)) {
      const full = join(base, name);
      writeFileSync(full, body);
      paths[name] = full;
    }
    return paths;
  }

  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("fails on a `[D12]` decision citation in a markdown doc", () => {
    const f = fixture({ "a.md": "# Doc\n\nSee [D12] for why.\n" });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/\[D#\]\s+"\[D12\]"/);
  });

  it("fails on a multi-citation `[D1, D2]` list", () => {
    const f = fixture({ "a.md": "# Doc\n\nSee [D1, D2].\n" });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/"\[D1, D2\]"/);
  });

  it("fails on the literal `[D#]` placeholder", () => {
    const f = fixture({ "a.md": "# Doc\n\nCite as [D#].\n" });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/"\[D#\]"/);
  });

  it("fails on a bare `§3.2` section citation", () => {
    const f = fixture({ "a.md": "# Doc\n\nSee §3.2 above.\n" });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/§N\s+"§3\.2"/);
  });

  it("fails on a `DoD §1` section citation", () => {
    const f = fixture({ "a.md": "# Doc\n\nPer DoD §1, this is done.\n" });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/"§1"/);
  });

  it("fails on a retired citation inside a code comment (block and line)", () => {
    const f = fixture({
      "a.ts": [
        "// See [D3] for background.",
        "const x = 1;",
        "/* also referenced in §4.1 */",
        "export default x;",
        "",
      ].join("\n"),
    });
    const { status, stderr } = run([f["a.ts"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/"\[D3\]"/);
    expect(stderr).toMatch(/"§4\.1"/);
  });

  it("ignores a retired-citation-shaped string OUTSIDE a comment (in-scope is comments only)", () => {
    const f = fixture({
      "a.ts": 'export const label = "[D3]";\n',
    });
    const { status, stdout } = run([f["a.ts"]]);
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });

  it("does not flag a legitimate external-standard `§` citation (e.g. WCAG)", () => {
    const f = fixture({
      "a.ts":
        "// Guards the nav link's target size (WCAG 2.2 §2.5.8 Target Size (Minimum)).\n" +
        "export const ok = true;\n",
    });
    const { status, stdout } = run([f["a.ts"]]);
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });

  it("ignores files that are neither markdown nor a recognized code extension", () => {
    const f = fixture({ "notes.txt": "See [D9] and §2 here.\n" });
    const { status, stdout } = run([f["notes.txt"]]);
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });

  it("passes a clean fixture with no retired citations", () => {
    const f = fixture({
      "a.md": "# Doc\n\nSee [the gate doc](./b.md) instead.\n",
    });
    const { status, stdout } = run([f["a.md"]]);
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });

  it("matches a no-space multi-citation list `[D1,D2]`", () => {
    const f = fixture({ "a.md": "# Doc\n\nSee [D1,D2].\n" });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/"\[D1,D2\]"/);
  });

  it("does NOT match `[D]` (no digit/# payload) or `[D12a]` (trailing non-digit)", () => {
    const f = fixture({ "a.md": "# Doc\n\nSee [D] and [D12a] here.\n" });
    const { status, stdout } = run([f["a.md"]]);
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });
});

describe("check-retired-citations.mjs — DEFECTS found (false positives)", () => {
  const dirs: string[] = [];

  function fixture(files: Record<string, string>): Record<string, string> {
    const base = mkdtempSync(join(tmpdir(), "retired-citations-defect-"));
    dirs.push(base);
    const paths: Record<string, string> = {};
    for (const [name, body] of Object.entries(files)) {
      const full = join(base, name);
      writeFileSync(full, body);
      paths[name] = full;
    }
    return paths;
  }

  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("DEFECT: a `§` inside a string literal's URL is misread as being inside a `//` comment", () => {
    // The comment-region regex (`\/\/.*$`) can't distinguish a real `//` comment start from
    // the `//` in `https://` sitting inside a plain string literal. A line with a URL
    // literal — no comment anywhere on it — gets its tail (from the URL's `//` onward)
    // misclassified as a "comment region", so a `§N`-shaped substring later on the SAME
    // line is wrongly flagged even though it's not in a comment at all. This violates the
    // script's own documented scope: "Scoped to code COMMENTS, not arbitrary code/string
    // content" (see the file header).
    //
    // Expected: NOT flagged (no comment on this line at all). Actual: flagged. This
    // assertion encodes the expected behavior and currently FAILS against the real script,
    // proving the false positive.
    const f = fixture({
      "a.ts":
        'const link = "https://example.com/§3.2";\nexport default link;\n',
    });
    const { status, stdout } = run([f["a.ts"]]);
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });

  it("DEFECT: an unversioned external-standard citation (`WCAG §1.4.3`, no version token) is not allowlisted", () => {
    // EXTERNAL_STANDARD_BEFORE_RE requires a version-shaped token between the standard name
    // and the `§` (`WCAG\s+[\w.]{1,10}\s*$`). "WCAG §1.4.3" — a perfectly legitimate,
    // unversioned reference to the WCAG spec — has nothing between "WCAG" and "§", so the
    // allowlist regex doesn't match and it's flagged as a retired internal `§N` citation.
    //
    // Expected: NOT flagged (WCAG is a recognized external standard regardless of whether a
    // version number is spelled out). Actual: flagged. This assertion encodes the expected
    // behavior and currently FAILS against the real script, proving the false positive.
    const f = fixture({
      "a.ts":
        "// See WCAG §1.4.3 for the minimum contrast ratio.\nexport const ok = true;\n",
    });
    const { status, stdout } = run([f["a.ts"]]);
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });
});

describe("check-retired-citations.mjs — known limitations (locked down, not asserted as bugs)", () => {
  const dirs: string[] = [];

  function fixture(files: Record<string, string>): Record<string, string> {
    const base = mkdtempSync(join(tmpdir(), "retired-citations-limits-"));
    dirs.push(base);
    const paths: Record<string, string> = {};
    for (const [name, body] of Object.entries(files)) {
      const full = join(base, name);
      writeFileSync(full, body);
      paths[name] = full;
    }
    return paths;
  }

  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("flags a `§N` citation shown as an illustrative example inside a fenced code block in markdown", () => {
    // Markdown is scanned as `wholeFile: true` with no fenced-code-block exclusion. A future
    // doc that documents the retired scheme by literally SHOWING `[D12]` as an example
    // (inside a ``` fence, to describe what NOT to do) will trip this guard. Per the
    // script's own comment ("the schemes only ever appeared in prose there") this is a
    // deliberate scope choice, not an oversight — locking down current behavior so a
    // silent regression (fenced blocks stop being scanned) is caught, and flagging it to
    // the author as a documented trade-off worth a second look.
    const f = fixture({
      "a.md":
        "# Doc\n\nOld citations looked like this:\n\n```\nSee [D12] for background.\n```\n",
    });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/"\[D12\]"/);
  });

  it("flags a standard name and its `§N` when split across two separate `//` comment lines", () => {
    // Each `//` comment is its own regex match/region, and the external-standard allowlist
    // only looks at the ~40 chars BEFORE the match WITHIN that same region. A standard name
    // wrapped onto the previous `//` line (e.g. a long comment line-wrapped by hand) is
    // therefore invisible to the allowlist even though a human reader would clearly see it
    // as one continuous "WCAG 2.2 §2.5.8" citation. Locking down current behavior; flagging
    // as a real (if narrower) instance of the same allowlist gap as the unversioned-standard
    // defect above.
    const f = fixture({
      "a.ts":
        "// See WCAG 2.2\n// §2.5.8 for details.\nexport const ok = true;\n",
    });
    const { status, stderr } = run([f["a.ts"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/"§2\.5\.8"/);
  });
});

describe("check-retired-citations.mjs — untracked files are out of scope (no argv override)", () => {
  const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const FIXTURE_PATH = join(
    REPO_ROOT,
    "qa-untracked-retired-citation-fixture.md",
  );

  afterAll(() => {
    rmSync(FIXTURE_PATH, { force: true });
  });

  it("does not flag a retired citation in a file that exists but is NOT git-tracked", () => {
    // With no argv, the script enumerates `git ls-files` — an untracked file physically
    // present in the working tree is invisible to it regardless of content. Written directly
    // into the repo root (not a tmpdir) because the untracked/tracked distinction only means
    // anything for files git actually knows about the repo.
    writeFileSync(FIXTURE_PATH, "# Untracked\n\nSee [D1] and §2 here.\n");
    const { status, stdout } = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(stdout).toMatch(/retired-citations: OK/);
    expect(status).toBe(0);
  });
});
