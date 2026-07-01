/**
 * Co-located test for the gate-doc sync guard (scripts/check-doc-gate-sync.mjs).
 *
 * Runs the script as a child process and asserts on exit code + output — never imports it
 * (the script calls process.exit). Happy path proves the real repo's two live sources
 * (definition-of-done.md, ci.yml) are in sync; drift detection runs the real script against throwaway
 * fixture trees and asserts exit 1 on divergence.
 */

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "check-doc-gate-sync.mjs");

function run(scriptPath: string) {
  return spawnSync(process.execPath, [scriptPath], { encoding: "utf8" });
}

describe("check-doc-gate-sync.mjs — happy path (real repo)", () => {
  it("passes with exit 0 — the live gate sources are in sync", () => {
    const { status, stdout, stderr } = run(SCRIPT);
    expect(stderr).not.toMatch(/FAIL/);
    expect(stdout).toMatch(/doc-gate-sync: OK/);
    expect(status).toBe(0);
  });
});

describe("check-doc-gate-sync.mjs — drift detection (fixtures)", () => {
  const dirs: string[] = [];

  const dod = (chain: string) =>
    `# DoD\n\n## 1. The one command\n\n\`\`\`bash\n${chain}\n\`\`\`\n`;

  const ci = (steps: string[]) =>
    `name: CI\njobs:\n  verify:\n    steps:\n      - run: pnpm install --frozen-lockfile\n` +
    steps.map((s) => `      - run: ${s}`).join("\n") +
    `\n  notify:\n    steps:\n      - run: echo done\n`;

  // Build a throwaway tree the real script reads relative to itself (`../`).
  function fixture(files: { dod: string; ci: string }): string {
    const base = mkdtempSync(join(tmpdir(), "doc-gate-"));
    dirs.push(base);
    const write = (rel: string, body: string) => {
      const full = join(base, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, body);
    };
    write("scripts/check-doc-gate-sync.mjs", readFileSync(SCRIPT, "utf8"));
    write("docs/definition-of-done.md", files.dod);
    write(".github/workflows/ci.yml", files.ci);
    return join(base, "scripts/check-doc-gate-sync.mjs");
  }

  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("passes when both sources match (and ignores `pnpm install`)", () => {
    const { status, stdout } = run(
      fixture({
        dod: dod("pnpm lint && \\\npnpm test && \\\npnpm build"),
        ci: ci(["pnpm lint", "pnpm test", "pnpm build"]),
      }),
    );
    expect(stdout).toMatch(/doc-gate-sync: OK/);
    expect(status).toBe(0);
  });

  it("fails when ci.yml is missing a gate step the doc lists", () => {
    const { status, stderr } = run(
      fixture({
        dod: dod("pnpm lint && pnpm test && pnpm build"),
        ci: ci(["pnpm lint", "pnpm build"]), // dropped `pnpm test`
      }),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/differs between sources/);
  });

  it("fails when the doc reorders the chain", () => {
    const { status, stderr } = run(
      fixture({
        dod: dod("pnpm test && pnpm lint && pnpm build"), // reordered
        ci: ci(["pnpm lint", "pnpm test", "pnpm build"]),
      }),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/differs between sources/);
  });

  it("fails loudly when the canonical section is absent", () => {
    const { status, stderr } = run(
      fixture({
        dod: "# DoD\n\nno gate section here\n",
        ci: ci(["pnpm lint", "pnpm build"]),
      }),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/The one command/);
  });
});
