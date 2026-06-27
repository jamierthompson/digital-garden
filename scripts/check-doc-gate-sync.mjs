// Gate-doc sync guard (`pnpm lint:docs`).
//
// The CI gate chain lives in two places that must agree, or a doc lies:
//   1. `docs/handbook/definition-of-done.md` → "## 1. The one command" — the canonical copy.
//   2. `.github/workflows/ci.yml` → the `verify` job's `- run:` steps — the REAL gate.
// (1) promises "same scripts, same order as CI"; every other doc points to it rather than
// restating it. `pnpm typecheck`/`lint` can't see prose, so nothing else catches the drift.
//
// Extract the chain from each, normalize to an ordered list of step commands, and assert
// both are identical. `ci.yml` setup steps (`actions/checkout`, `pnpm install`, …) are
// dropped — only `pnpm`/`git` gate commands count. It's a text check (no YAML/Markdown
// parser): robust because the sources have stable, simple shapes.

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

// A shell chain (`pnpm lint && pnpm test && \`, possibly line-wrapped) → ordered list of
// commands. `pnpm --filter studio typegen && git diff …` splits into two steps, matching
// how `ci.yml` lists them as two separate `- run:` lines.
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

const [dodMd, ciYml] = await Promise.all([
  read("docs/handbook/definition-of-done.md"),
  read(".github/workflows/ci.yml"),
]);

const sources = {
  "definition-of-done.md (§1)": normalize(
    splitChain(
      fencedBlockAfter(dodMd, /^##\s+1\.\s+The one command/, "The one command"),
    ),
  ),
  "ci.yml (verify job)": normalize(
    ciRunSteps(ciYml).flatMap((step) => splitChain(step)),
  ),
};

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
          `\nKeep both in sync — change the gate in one place and the other must match.` +
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
