// Gate-integrity test runner — the `pnpm test` entry point.
//
// WHY THIS EXISTS (issue #165)
// ----------------------------
// `vitest run` can print `× N failed` yet exit 0, letting the gate chain
// (`… && pnpm test && … && pnpm build`) run past red and read green. On a
// production-deploy-on-merge repo that silently voids the whole
// local-gate-mirrors-CI guarantee.
//
// ROOT CAUSE. Vitest derives the process exit code in `TestRun.end`
// (`node_modules/vitest/dist/chunks/cli-api.<hash>.js`) from
//   const modules = specs.map((s) => s.testModule).filter((s) => s != null);
//   state = hasFailed(modules) ? "failed" : "passed"; // exitCode = 1 only if "failed"
// Two facts make that exit code untrustworthy under load (the #165 multi-agent
// context):
//   1. `TestModule.ok()` returns TRUE for a file whose result never finalized
//      ("if the test is not finished yet … it will return true", cli-api
//      ~L11555). So a spec whose File task IS in `state.idMap` but whose
//      file-level result was lost/interrupted reads as PASSING in the exit-code
//      decision → the process exits 0.
//   2. The dual-project config (`vitest.config.ts` runs the engine glob under
//      both `node` and `jsdom`) makes every file two specs, so a stalled
//      node-spec sits beside a finished, green jsdom-spec of the same file —
//      nothing in the exit code flags it.
// Meanwhile the STREAMING default reporter has already printed each child
// test's `×` (timeout) from earlier task updates. Net: reporter shows
// `N failed`, process exits 0.
//
// THE FIX. Cross-check the exit code against the `json` reporter, which counts
// INDIVIDUAL child test tasks whose `result.state === "fail"` (index.<hash>.js,
// JsonReporter) — those streamed timeout failures ARE recorded there even when
// the file-level `ok()` masked them from the exit code. We run vitest with the
// normal `default` reporter (unchanged dev output) PLUS a `json` reporter to a
// temp file, then INDEPENDENTLY assert via `verdict()`: the gate fails if
// EITHER vitest's exit code is non-zero, OR the report records any failed
// test/suite, OR (fail-closed) the run was signalled, the report is unreadable,
// or ZERO tests ran. Belt-and-suspenders for the plausible #165 shape (File
// task present in idMap, child fails recorded).
//
// RESIDUAL BLIND SPOT (honest scope). If a spec's File task is entirely ABSENT
// from `state.idMap` (`spec.testModule` is `undefined`, cli-api ~L10582),
// `TestRun.end` drops it with `.filter((s) => s != null)` and hands that SAME
// filtered array to the JsonReporter — so a fully-dropped spec is invisible to
// the exit code AND the report. That shape is not closable from the report
// alone; it would need a spec-count reconciliation vitest does not expose. The
// observed #165 incident printed the failures (so the tasks WERE in idMap),
// which is exactly the shape this fix covers.
//
// Why not `--bail=1`? Bail changes WHEN the run stops (first failure), not HOW
// the exit code is computed — a dropped result never triggers bail either, so
// it doesn't close this divergence. Targeting the actual defect (exit code vs.
// reported failures) is the correct, minimal lever.
//
// Extra CLI args are forwarded to vitest, so `pnpm test <path>` still narrows
// the run. Watch mode stays on plain `vitest` (`pnpm test:watch`).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Pure gate decision, unit-testable in isolation (the durable #165 regression
 * guard). Given the outcome of a `vitest run`, decide whether the gate passes.
 * Fails CLOSED: any signal, any unreadable report (missing, wrong-shaped, or
 * carrying a non-finite count), any failing report, any non-zero vitest code,
 * any recorded failure, or a run in which ZERO tests executed ⇒ not ok.
 *
 * @param {{ vitestCode: number, signal: string | null, report: unknown }} input
 *   `report` is the parsed `json`-reporter object, or `null` if it could not be
 *   read/parsed.
 * @returns {{ ok: boolean, message: string }}
 */
export function verdict({ vitestCode, signal, report }) {
  // A signal (SIGKILL/SIGTERM under OOM or a killed worker) leaves no
  // trustworthy result — never let a crash read as green.
  if (signal) {
    return { ok: false, message: `vitest terminated by signal ${signal}.` };
  }

  // No parseable report means we CANNOT verify the run — never pass unverified.
  if (report === null || typeof report !== "object") {
    return {
      ok: false,
      message:
        `vitest exited ${vitestCode} but produced no readable JSON report; ` +
        `refusing to report green unverified.`,
    };
  }

  const failedTests = Number(report.numFailedTests ?? 0);
  const failedSuites = Number(report.numFailedTestSuites ?? 0);
  const totalTests = Number(report.numTotalTests ?? 0);
  const reportedGreen = report.success === true;

  // A count we cannot interpret IS an unreadable report — fail closed. `NaN`
  // (from a non-numeric field like `numTotalTests: "x"` or a garbage
  // `numFailedTests`) slips past BOTH `> 0` and `=== 0`, so without this it
  // would sail through every numeric guard below and read green. A missing
  // field is fine — `?? 0` makes it a finite 0.
  if (![failedTests, failedSuites, totalTests].every(Number.isFinite)) {
    return {
      ok: false,
      message:
        `vitest exited ${vitestCode} but its JSON report carries a non-numeric ` +
        `count (numFailedTests=${JSON.stringify(report.numFailedTests)}, ` +
        `numFailedTestSuites=${JSON.stringify(report.numFailedTestSuites)}, ` +
        `numTotalTests=${JSON.stringify(report.numTotalTests)}); refusing to ` +
        `report green on an uninterpretable report.`,
    };
  }

  if (vitestCode !== 0) {
    // Vitest's own exit code already caught it; surface the count for the log.
    return {
      ok: false,
      message:
        `vitest exited ${vitestCode} ` +
        `(${failedTests} failed test(s), ${failedSuites} failed suite(s)).`,
    };
  }

  if (failedTests > 0 || failedSuites > 0 || !reportedGreen) {
    // The #165 divergence: vitest exited 0 while the report records failures.
    return {
      ok: false,
      message:
        `vitest exited 0 but its JSON report records failures — ` +
        `${failedTests} failed test(s), ${failedSuites} failed suite(s), ` +
        `success=${report.success}. This is exactly the exit-code-vs-failures ` +
        `divergence #165 guards against.`,
    };
  }

  // A clean report that ran ZERO tests certifies nothing: vitest sets
  // `success: true` whenever `passWithNoTests` is in effect (see
  // index.<hash>.js `success = (files.length > 0 || passWithNoTests) && …`),
  // even though nothing executed. Refuse to read green on an empty run — a
  // stray `--passWithNoTests`, or a narrowed path (`pnpm test <glob>`) or a
  // rename that now matches no files. A gate pass must mean "the suite ran and
  // was green", never "nothing ran" — the same fail-open class as #165.
  if (totalTests === 0) {
    return {
      ok: false,
      message:
        `vitest exited 0 with no recorded failures, but ZERO tests ran — an ` +
        `empty run verifies nothing (e.g. --passWithNoTests, or a path that ` +
        `now matches no files). Refusing to report green on a suite that never ran.`,
    };
  }

  return {
    ok: true,
    message: `${report.numPassedTests ?? 0} passed, 0 failed (exit code and JSON report agree).`,
  };
}

async function main() {
  const forwarded = process.argv.slice(2);

  // A per-invocation temp dir avoids collisions between concurrent runs.
  const dir = mkdtempSync(join(tmpdir(), "vitest-gate-"));
  const resultsFile = join(dir, "results.json");

  const result = spawnSync(
    "vitest",
    [
      "run",
      "--reporter=default",
      "--reporter=json",
      `--outputFile=${resultsFile}`,
      ...forwarded,
    ],
    { stdio: "inherit", shell: false },
  );

  if (result.error) {
    rmSync(dir, { recursive: true, force: true });
    console.error(
      `\nrun-tests: GATE FAIL — could not launch vitest (${result.error.message}).`,
    );
    process.exit(1);
  }

  let report = null;
  try {
    report = JSON.parse(readFileSync(resultsFile, "utf8"));
  } catch {
    report = null;
  }
  rmSync(dir, { recursive: true, force: true });

  const { ok, message } = verdict({
    vitestCode: result.status ?? 1,
    signal: result.signal,
    report,
  });

  if (!ok) {
    console.error(`\nrun-tests: GATE FAIL — ${message}`);
    process.exit(1);
  }
  console.log(`run-tests: OK — ${message}`);
  process.exit(0);
}

// Run only when invoked directly (`node scripts/run-tests.mjs`), so the test
// can import `verdict` without spawning vitest.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
