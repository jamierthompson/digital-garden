/**
 * Co-located tests for the gate-integrity test runner (scripts/run-tests.mjs), the
 * `pnpm test` entry point that closes issue #165 — `vitest run` printing `× N failed`
 * yet exiting 0.
 *
 * Two layers:
 *   1. `verdict()` unit tests — the pure decision, the DURABLE regression guard. These
 *      pin the exact #165 case (vitest exit 0 + report records failures ⇒ gate FAIL) and
 *      the fail-closed edges, deterministically and without spawning anything.
 *   2. End-to-end tests that actually run `node scripts/run-tests.mjs` against tiny
 *      fixtures under an ISOLATED scratch vitest config, proving the spawn → json-report
 *      → verdict → exit-code wiring end to end (green, red, dual-project masking,
 *      suite-level failure, arg forwarding, --passWithNoTests, and launch failure).
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { verdict } from "./run-tests.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "run-tests.mjs");
const REPO_ROOT = join(HERE, "..");

// e2e scratch projects live UNDER node_modules/.cache — deliberately, not in the
// repo root. That directory is gitignored AND inside vitest's default
// `**/node_modules/**` exclude, so if the runner is SIGKILLed mid-test (the exact
// multi-agent-load context of this repo) a leaked scratch containing a red fixture
// is neither collected by the next `pnpm test`/`test:watch` nor left as untracked
// git pollution. The child vitest still resolves `vitest/config` (real node_modules
// is an ancestor) and collects the fixture (exclude is matched relative to the
// scratch root, where the path has no `node_modules` segment).
const SCRATCH_PARENT = join(
  REPO_ROOT,
  "node_modules",
  ".cache",
  "qa-run-tests",
);

describe("verdict — the #165 exit-code-vs-failures guard", () => {
  it("passes only when vitest exits 0 AND the report is clean", () => {
    const { ok } = verdict({
      vitestCode: 0,
      signal: null,
      report: {
        success: true,
        numTotalTests: 42,
        numPassedTests: 42,
        numFailedTests: 0,
        numFailedTestSuites: 0,
      },
    });
    expect(ok).toBe(true);
  });

  it("FAILS when vitest exits 0 but the report records failed tests (the #165 bug)", () => {
    const { ok, message } = verdict({
      vitestCode: 0,
      signal: null,
      report: { success: false, numFailedTests: 3, numFailedTestSuites: 3 },
    });
    expect(ok).toBe(false);
    expect(message).toContain("#165");
  });

  it("FAILS when the report records a failed suite even with zero failed tests", () => {
    const { ok } = verdict({
      vitestCode: 0,
      signal: null,
      report: { success: false, numFailedTests: 0, numFailedTestSuites: 1 },
    });
    expect(ok).toBe(false);
  });

  it("FAILS when success is not literally true even if counts look clean", () => {
    const { ok } = verdict({
      vitestCode: 0,
      signal: null,
      report: { numFailedTests: 0, numFailedTestSuites: 0 },
    });
    expect(ok).toBe(false);
  });

  it("FAILS closed when vitest is killed by a signal (no trustworthy result)", () => {
    // A signalled process reports status null; the runner coerces to 1 before calling
    // verdict (`result.status ?? 1`), so a realistic call passes a number here.
    const { ok, message } = verdict({
      vitestCode: 1,
      signal: "SIGKILL",
      report: { success: true, numFailedTests: 0, numFailedTestSuites: 0 },
    });
    expect(ok).toBe(false);
    expect(message).toContain("SIGKILL");
  });

  it("FAILS closed when the JSON report is missing/unparseable", () => {
    const { ok } = verdict({ vitestCode: 0, signal: null, report: null });
    expect(ok).toBe(false);
  });

  it("FAILS when vitest's own exit code is non-zero", () => {
    const { ok } = verdict({
      vitestCode: 1,
      signal: null,
      report: { success: false, numFailedTests: 1, numFailedTestSuites: 1 },
    });
    expect(ok).toBe(false);
  });

  describe("QA — fail-closed gaps (adversarial additions)", () => {
    it("FAILS when zero tests ran, even if the report claims success (an empty run verifies nothing)", () => {
      // Reachable today: `pnpm test --passWithNoTests <path-matching-nothing>` exits 0
      // with a success:true report — the gate reads green having proven nothing.
      // Vitest computes `success = (files.length > 0 || passWithNoTests) && …`
      // (node_modules/vitest/dist/chunks/index.UpGiHP7g.js:3552), so success alone
      // does not certify that anything executed. A GATE pass must mean "the suite
      // ran and was green", never "nothing ran".
      const { ok } = verdict({
        vitestCode: 0,
        signal: null,
        report: {
          success: true,
          numTotalTests: 0,
          numPassedTests: 0,
          numFailedTests: 0,
          numFailedTestSuites: 0,
        },
      });
      expect(ok).toBe(false);
    });

    it("FAILS closed when the parsed report is an array (typeof 'object' but not the reporter shape)", () => {
      const { ok } = verdict({ vitestCode: 0, signal: null, report: [] });
      expect(ok).toBe(false);
    });

    it("FAILS closed on a signalled run even when status was never coerced (vitestCode 0 + signal)", () => {
      // Belt-and-suspenders: the signal branch must win regardless of the code passed.
      const { ok } = verdict({
        vitestCode: 0,
        signal: "SIGTERM",
        report: { success: true, numFailedTests: 0, numFailedTestSuites: 0 },
      });
      expect(ok).toBe(false);
    });

    it("FAILS closed when numTotalTests is present but not a finite number", () => {
      // `Number("not-a-number")` is NaN; NaN slips past BOTH `totalTests === 0`
      // and `failedTests > 0`. A count the gate cannot interpret must never read
      // green — same fail-closed contract as an unreadable report.
      const { ok } = verdict({
        vitestCode: 0,
        signal: null,
        report: {
          success: true,
          numTotalTests: "not-a-number",
          numPassedTests: 0,
          numFailedTests: 0,
          numFailedTestSuites: 0,
        },
      });
      expect(ok).toBe(false);
    });

    it("FAILS closed when a failure count is present but not a finite number", () => {
      // NaN > 0 is false — a garbage numFailedTests must not be treated as zero.
      const { ok } = verdict({
        vitestCode: 0,
        signal: null,
        report: {
          success: true,
          numTotalTests: 5,
          numPassedTests: 5,
          numFailedTests: {},
          numFailedTestSuites: 0,
        },
      });
      expect(ok).toBe(false);
    });
  });
});

describe("run-tests.mjs — end-to-end against isolated fixtures", () => {
  const scratchDirs: string[] = [];

  afterEach(() => {
    for (const d of scratchDirs.splice(0))
      rmSync(d, { recursive: true, force: true });
  });

  /**
   * Runs the wrapper against a scratch project whose single test file has the given body,
   * fully isolated from this repo's own vitest config/projects via `--root` + `--config`.
   * `configBody` swaps the scratch vitest config; `extraArgs` are forwarded to the wrapper
   * (exactly like `pnpm test -- <args>`); `env` overrides the child environment.
   */
  function runWrapper(
    testBody: string | null,
    opts: {
      configBody?: string;
      extraArgs?: string[];
      env?: NodeJS.ProcessEnv;
    } = {},
  ) {
    mkdirSync(SCRATCH_PARENT, { recursive: true });
    const scratch = mkdtempSync(join(SCRATCH_PARENT, "s-"));
    scratchDirs.push(scratch);
    mkdirSync(join(scratch, "t"), { recursive: true });
    writeFileSync(
      join(scratch, "vitest.config.ts"),
      opts.configBody ??
        `import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { include: ["t/**/*.test.ts"] } });\n`,
    );
    if (testBody !== null)
      writeFileSync(join(scratch, "t", "fixture.test.ts"), testBody);

    return spawnSync(
      process.execPath,
      [
        SCRIPT,
        "--root",
        scratch,
        "--config",
        join(scratch, "vitest.config.ts"),
        ...(opts.extraArgs ?? []),
      ],
      { encoding: "utf8", cwd: REPO_ROOT, env: opts.env ?? process.env },
    );
  }

  it("exits 0 and reports OK for a genuinely green fixture", () => {
    const res = runWrapper(
      `import { test, expect } from "vitest";\ntest("green", () => { expect(1).toBe(1); });\n`,
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("run-tests: OK");
  });

  it("exits non-zero and reports GATE FAIL for a failing fixture", () => {
    const res = runWrapper(
      `import { test, expect } from "vitest";\ntest("red", () => { expect(1).toBe(2); });\n`,
    );
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain("GATE FAIL");
  });

  describe("QA — adversarial additions", () => {
    /** Mirrors the repo's dual-env setup: the same glob under node AND jsdom. */
    const DUAL_PROJECT_CONFIG = `import { defineConfig } from "vitest/config";
export default defineConfig({ test: { projects: [
  { test: { name: "node", environment: "node", include: ["t/**/*.test.ts"] } },
  { test: { name: "jsdom", environment: "jsdom", include: ["t/**/*.test.ts"] } },
] } });
`;

    it("FAILS when a file passes under jsdom but fails under node (the #165 dual-project masking shape)", () => {
      // The original incident: a red node-spec masked by the green jsdom-spec of
      // the SAME file. The JSON report must aggregate both projects' results.
      const res = runWrapper(
        `import { test, expect } from "vitest";\ntest("needs a DOM", () => { expect(typeof document).toBe("object"); });\n`,
        { configBody: DUAL_PROJECT_CONFIG },
      );
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain("GATE FAIL");
    });

    it("FAILS on a suite-level failure — a file that throws at import records zero failed TESTS", () => {
      const res = runWrapper(`throw new Error("boom at import");\n`);
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain("GATE FAIL");
    });

    it("still narrows AND still gates with forwarded args (-t plus an extra --reporter)", () => {
      // The fixture contains a red test; `-t green` must exclude it (narrowing works)
      // and the forwarded extra reporter must not displace the JSON reporter the
      // verdict depends on (reporters accumulate; losing the report would fail-close
      // a genuinely green run).
      const res = runWrapper(
        `import { test, expect } from "vitest";\ntest("green", () => { expect(1).toBe(1); });\ntest("red", () => { expect(1).toBe(2); });\n`,
        { extraArgs: ["--reporter=verbose", "-t", "green"] },
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain("run-tests: OK");
      expect(res.stdout).toContain("1 passed");
    });

    it("FAILS (never reads green) when a forwarded --passWithNoTests yields a zero-test run", () => {
      // vitest exits 0 with a success:true report here — but a gate pass on an
      // empty run certifies nothing. Must fail closed.
      const res = runWrapper(null, { extraArgs: ["--passWithNoTests"] });
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain("GATE FAIL");
    });

    it("FAILS closed when vitest cannot be launched at all", () => {
      // Strip node_modules/.bin from PATH: spawnSync("vitest") must ENOENT and the
      // wrapper must report a launch failure, never a silent green.
      const res = runWrapper(
        `import { test, expect } from "vitest";\ntest("green", () => { expect(1).toBe(1); });\n`,
        { env: { ...process.env, PATH: "/usr/bin:/bin" } },
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain("could not launch vitest");
    });
  });
});
