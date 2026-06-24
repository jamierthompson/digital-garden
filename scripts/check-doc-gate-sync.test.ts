/**
 * Co-located test for the gate-doc sync guard (scripts/check-doc-gate-sync.mjs).
 *
 * NODE-SAFE BY DESIGN: it runs the script as a child process and asserts on exit
 * code + output; it never imports it. Mirrors check-key-drift.test.ts. Two layers:
 *   • Happy path — the script against the REAL repo passes (exit 0), proving the
 *     three live sources (AGENTS.md, DoD §1, ci.yml) are actually in sync.
 *   • Drift detection — run against throwaway FIXTURE trees (the real script beside
 *     hand-built doc sources) and assert exit 1 on divergence, exit 0 when synced.
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

  const agents = (chain: string) =>
    `# AGENTS\n\n## Pre-flight checks (the gate)\n\n\`\`\`bash\n${chain}\n\`\`\`\n`;

  const dod = (chain: string) =>
    `# DoD\n\n## 1. The one command\n\n\`\`\`bash\n${chain}\n\`\`\`\n`;

  const ci = (steps: string[]) =>
    `name: CI\njobs:\n  verify:\n    steps:\n      - run: pnpm install --frozen-lockfile\n` +
    steps.map((s) => `      - run: ${s}`).join("\n") +
    `\n  notify:\n    steps:\n      - run: echo done\n`;

  // Build a throwaway tree the real script reads relative to itself (`../`).
  function fixture(files: { agents: string; dod: string; ci: string }): string {
    const base = mkdtempSync(join(tmpdir(), "doc-gate-"));
    dirs.push(base);
    const write = (rel: string, body: string) => {
      const full = join(base, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, body);
    };
    write("scripts/check-doc-gate-sync.mjs", readFileSync(SCRIPT, "utf8"));
    write("AGENTS.md", files.agents);
    write("docs/handbook/definition-of-done.md", files.dod);
    write(".github/workflows/ci.yml", files.ci);
    return join(base, "scripts/check-doc-gate-sync.mjs");
  }

  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("passes when all three sources match (and ignores `pnpm install`)", () => {
    const { status, stdout } = run(
      fixture({
        agents: agents("pnpm lint && pnpm test && pnpm build"),
        dod: dod("pnpm lint && \\\npnpm test && \\\npnpm build"),
        ci: ci(["pnpm lint", "pnpm test", "pnpm build"]),
      }),
    );
    expect(stdout).toMatch(/doc-gate-sync: OK/);
    expect(status).toBe(0);
  });

  it("fails when ci.yml is missing a gate step the docs list", () => {
    const { status, stderr } = run(
      fixture({
        agents: agents("pnpm lint && pnpm test && pnpm build"),
        dod: dod("pnpm lint && pnpm test && pnpm build"),
        ci: ci(["pnpm lint", "pnpm build"]), // dropped `pnpm test`
      }),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/differs between sources/);
  });

  it("fails when a doc reorders the chain", () => {
    const { status, stderr } = run(
      fixture({
        agents: agents("pnpm lint && pnpm test && pnpm build"),
        dod: dod("pnpm test && pnpm lint && pnpm build"), // reordered
        ci: ci(["pnpm lint", "pnpm test", "pnpm build"]),
      }),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/differs between sources/);
  });

  it("fails loudly when a required section is absent", () => {
    const { status, stderr } = run(
      fixture({
        agents: "# AGENTS\n\nno gate section here\n",
        dod: dod("pnpm lint && pnpm build"),
        ci: ci(["pnpm lint", "pnpm build"]),
      }),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/Pre-flight checks/);
  });
});
