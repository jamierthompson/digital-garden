/**
 * Co-located test for the markdown link/anchor checker (scripts/check-doc-links.mjs).
 *
 * Runs the script as a child process and asserts on exit code + output — never imports it
 * (the script calls process.exit). The happy path proves the real repo's tracked `*.md`
 * links all resolve; the failure cases pass throwaway fixture files as argv and assert the
 * checker actually detects each breakage class (a checker that never fails is worthless).
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "check-doc-links.mjs");

function run(fileArgs: string[] = []) {
  return spawnSync(process.execPath, [SCRIPT, ...fileArgs], {
    encoding: "utf8",
  });
}

describe("check-doc-links.mjs — happy path (real repo)", () => {
  it("passes with exit 0 — every tracked internal link resolves", () => {
    const { status, stdout, stderr } = run();
    expect(stderr).not.toMatch(/FAIL/);
    expect(stdout).toMatch(/doc-links: OK/);
    expect(status).toBe(0);
  });
});

describe("check-doc-links.mjs — breakage detection (fixtures)", () => {
  const dirs: string[] = [];

  // Write files into a throwaway dir and return their absolute paths by key.
  function fixture(files: Record<string, string>): Record<string, string> {
    const base = mkdtempSync(join(tmpdir(), "doc-links-"));
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

  it("passes valid relative links, same-file anchors, and cross-file anchors", () => {
    const f = fixture({
      "a.md":
        "# Title\n\n## The `@layer` Trap\n\n[self](#the-layer-trap) and [b](b.md#deep-heading)\n",
      "b.md": "# B\n\n## Deep Heading\n",
    });
    const { status, stdout } = run([f["a.md"], f["b.md"]]);
    expect(stdout).toMatch(/doc-links: OK/);
    expect(status).toBe(0);
  });

  it("fails on a relative link to a missing file", () => {
    const f = fixture({ "a.md": "# A\n\n[gone](./nope.md)\n" });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/target file does not exist/);
  });

  it("fails on a dead same-file anchor", () => {
    const f = fixture({
      "a.md": "# A\n\n## Real Heading\n\n[bad](#missing-heading)\n",
    });
    const { status, stderr } = run([f["a.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/no heading anchor "#missing-heading"/);
  });

  it("fails on a dead cross-file anchor into another markdown file", () => {
    const f = fixture({
      "a.md": "# A\n\n[bad](b.md#not-there)\n",
      "b.md": "# B\n\n## Only Heading\n",
    });
    const { status, stderr } = run([f["a.md"], f["b.md"]]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/no heading anchor "#not-there" in/);
  });

  it("skips external URLs (no network, never fails on them)", () => {
    const f = fixture({
      "a.md":
        "# A\n\n[x](https://example.com/missing) [m](mailto:a@b.co) [proto](//cdn.example/x)\n",
    });
    const { status, stdout } = run([f["a.md"]]);
    expect(stdout).toMatch(/doc-links: OK/);
    expect(status).toBe(0);
  });

  it("ignores links inside fenced code blocks and inline code", () => {
    const f = fixture({
      "a.md":
        "# A\n\n```md\n[not a link](./nope.md)\n```\n\nand inline `[x](./also-nope.md)` too\n",
    });
    const { status, stdout } = run([f["a.md"]]);
    expect(stdout).toMatch(/doc-links: OK/);
    expect(status).toBe(0);
  });
});
