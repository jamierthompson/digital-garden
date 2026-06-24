// Gate-doc sync guard (`pnpm lint:docs`).
//
// THE PROBLEM
// -----------
// The CI gate — the ordered chain of `pnpm` checks that must pass before merge — is
// written down in THREE places that must agree, or a doc lies:
//
//   1. `AGENTS.md` → "## Pre-flight checks (the gate)" — the agent-facing copy-paste chain.
//   2. `docs/handbook/definition-of-done.md` → "## 1. The one command" — the human bar.
//   3. `.github/workflows/ci.yml` → the `verify` job's `- run:` steps — the REAL gate.
//
// (1) and (2) both promise "same scripts, same order as CI". When someone adds or reorders
// a gate step in `ci.yml` but forgets a doc (or vice versa), the docs silently mislead —
// exactly the doc-rot this repo asks everyone to kill on sight (orientation "Golden rules").
// `pnpm typecheck`/`lint` can't see prose, so without this guard nothing catches the drift.
//
// WHAT THIS CHECKS
// ----------------
// Extract the gate chain from each of the three sources, normalize each to an ordered list
// of step commands, and assert all three are IDENTICAL (same steps, same order). On a
// mismatch it prints each source's list and the first divergence, and exits non-zero.
//
// `ci.yml` carries setup steps that aren't part of the gate (`actions/checkout`,
// `pnpm install`, …); those are dropped — only the `pnpm`/`git` gate commands count. This
// script's own step (`pnpm lint:docs`) IS part of the canonical chain, so it must appear in
// all three (a guard that runs as part of the gate it guards — self-consistent, not circular).
//
// It is a TEXT check (no YAML/Markdown parser dependency) — robust enough because the three
// sources have stable, simple shapes and this runs in CI on every PR.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

const fail = (msg) => {
  console.error(`doc-gate-sync: FAIL — ${msg}`);
  process.exit(1);
};

const read = async (rel) => {
  const path = fileURLToPath(new URL(rel, root));
  return readFile(path, "utf8").catch((err) =>
    fail(`could not read ${rel} (${err.message})`),
  );
};

// --- Normalization --------------------------------------------------------------

// A shell chain like `pnpm lint && pnpm test && \` (possibly wrapped across lines)
// → ordered list of individual commands. Splits on `&&`, drops line-continuations,
// comments, and blanks. `pnpm --filter studio typegen && git diff …` becomes two steps,
// matching how `ci.yml` lists them as two separate `- run:` lines.
const splitChain = (text) =>
  text
    .replace(/\\\s*\n/g, " ") // join `\`-continued lines
    .replace(/\n/g, " ")
    .split("&&")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));

// Steps that are environment setup, not gate checks — never part of the chain.
const isSetupStep = (cmd) => /^pnpm install\b/.test(cmd);

const normalize = (steps) =>
  steps.map((s) => s.trim()).filter((s) => !isSetupStep(s));

// --- Extractors -----------------------------------------------------------------

// The first fenced ```…``` code block AFTER a heading whose text matches `headingRe`.
function fencedBlockAfter(md, headingRe, label) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start === -1) fail(`could not find the "${label}" heading`);
  const open = lines.findIndex((l, i) => i > start && /^```/.test(l));
  if (open === -1) fail(`no code block after the "${label}" heading`);
  const close = lines.findIndex((l, i) => i > open && /^```/.test(l));
  if (close === -1)
    fail(`unterminated code block after the "${label}" heading`);
  return lines.slice(open + 1, close).join("\n");
}

// The `verify` job's `- run:` commands, in order. Stops at the next top-level job.
function ciRunSteps(yml) {
  const lines = yml.split("\n");
  const jobStart = lines.findIndex((l) => /^\s{2}verify:/.test(l));
  if (jobStart === -1) fail("could not find the `verify:` job in ci.yml");
  const steps = [];
  for (let i = jobStart + 1; i < lines.length; i++) {
    // A new top-level job (2-space indented `name:`) ends the verify block.
    if (/^\s{2}\S.*:\s*$/.test(lines[i]) && !/^\s{4}/.test(lines[i])) break;
    const m = lines[i].match(/^\s*-\s*run:\s*(.+?)\s*$/);
    if (m) steps.push(m[1]);
  }
  if (steps.length === 0) fail("no `- run:` steps found in the `verify` job");
  return steps;
}

// --- Load + normalize all three sources -----------------------------------------

const [agentsMd, dodMd, ciYml] = await Promise.all([
  read("AGENTS.md"),
  read("docs/handbook/definition-of-done.md"),
  read(".github/workflows/ci.yml"),
]);

const sources = {
  "AGENTS.md (Pre-flight checks)": normalize(
    splitChain(
      fencedBlockAfter(
        agentsMd,
        /^##\s+Pre-flight checks/,
        "Pre-flight checks",
      ),
    ),
  ),
  "definition-of-done.md (§1)": normalize(
    splitChain(
      fencedBlockAfter(dodMd, /^##\s+1\.\s+The one command/, "The one command"),
    ),
  ),
  "ci.yml (verify job)": normalize(
    ciRunSteps(ciYml).flatMap((step) => splitChain(step)),
  ),
};

// --- Compare ---------------------------------------------------------------------

const names = Object.keys(sources);
const reference = sources[names[0]];

for (const name of names.slice(1)) {
  const list = sources[name];
  const max = Math.max(reference.length, list.length);
  for (let i = 0; i < max; i++) {
    if (reference[i] !== list[i]) {
      const show = (n, arr) =>
        `\n  ${n}:\n${arr.map((s, j) => `    ${j + 1}. ${s}`).join("\n")}`;
      fail(
        `the gate chain differs between sources (first divergence at step ${i + 1}: ` +
          `"${reference[i] ?? "—"}" vs "${list[i] ?? "—"}").` +
          `\nKeep all three in sync — change the gate in one place and the others must match.` +
          show(names[0], reference) +
          show(name, list),
      );
    }
  }
}

console.log(
  `doc-gate-sync: OK — the gate chain matches across all ${names.length} sources ` +
    `(${reference.length} steps: ${reference.join(" → ")}).`,
);
process.exit(0);
