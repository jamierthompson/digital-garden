// Retired-citation regression guard (part of `pnpm lint:docs`).
//
// Both the `[D#]` decision-citation scheme and the `§N` architecture-section-citation
// scheme are retired: docs are the current truth, edited in place, with git history as
// the audit trail (no decision log; cross-references now use descriptive names / heading
// anchors instead). This fails if either scheme reappears in a tracked `*.md` doc or in a
// code comment.
//
// Scoped to code COMMENTS, not arbitrary code/string content — a retired-citation-shaped
// substring inside an unrelated string literal is out of scope for this lightweight guard.
// Markdown files are scanned in full (the schemes only ever appeared in prose there).
//
// Known false positive this guards against: citing an EXTERNAL standard's own section
// with `§` (e.g. "WCAG 2.2 §2.5.8" — see src/components/site-chrome/SiteNav.test.tsx)
// is a legitimate, encouraged citation (see docs/working-with-agents.md's "cite the
// standard" rule), NOT the retired internal `§N` scheme. `EXTERNAL_STANDARD_BEFORE_RE`
// excludes a `§N` immediately preceded by a recognized standard name + version.
//
// Self-reference gotcha: this script's own describing comments (directly above, and in
// its co-located test's fixtures) necessarily contain the literal patterns it matches —
// both files are excluded by path so a clean repo passes.
//
// Enumeration is `git ls-files` by default; pass explicit file paths as argv to check a
// subset (used by the co-located test to run against fixture trees, mirroring
// check-doc-links.mjs).

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const EXCLUDED = new Set([
  "scripts/check-retired-citations.mjs",
  "scripts/check-retired-citations.test.ts",
]);

const MARKDOWN_RE = /\.md$/i;
const CODE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/i;

// `[D12]`, `[D1, D2]`, and the literal `[D#]` placeholder.
const DECISION_CITATION_RE = /\[D(?:\d+|#)(?:\s*,\s*D(?:\d+|#))*\]/gu;

// `§3.2`, `DoD §1`. `§` is a single BMP code point (U+00A7); `/u` makes that explicit
// rather than relying on the engine's default (non-unicode) mode by accident.
const SECTION_CITATION_RE = /§\s*\d+(?:\.\d+)*/gu;

// A `§N` immediately preceded by a recognized external standard name — with or without a
// version token (e.g. both "WCAG 2.2 §2.5.8" and the equally legitimate, unversioned
// "WCAG §1.4.3") — is a legitimate citation, not the retired internal scheme. Checked
// against the ~40 chars before the match; the version token itself is optional.
const EXTERNAL_STANDARD_BEFORE_RE =
  /\b(?:WCAG|RFC|ISO|ECMA(?:Script)?|WAI-ARIA|W3C)(?:\s+[\w.]{1,10})?\s*$/iu;

// Comment regions of a code file: `/* … */` (incl. multiline) and `// …` to end of line.
// A lightweight heuristic (no tokenizer): it can't tell a `//`/`/*` inside a string
// literal from a real comment. The `(?<!:)` guard on the line-comment alternative
// excludes the `//` in a `://` URL scheme (e.g. a `"https://…"` string literal) from
// being misread as a comment start — a real comment earlier on the same line still
// matches from its own (non-`:`-preceded) `//`. Residual limitation: a `//` elsewhere
// inside a string literal that ISN'T part of a URL scheme (rare) can still be
// misclassified; out of scope for this lightweight guard.
const COMMENT_RE = /\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm;

function* commentRegions(text) {
  for (const m of text.matchAll(COMMENT_RE)) {
    yield { text: m[0], index: m.index };
  }
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

function findViolations(text, { wholeFile }) {
  const violations = [];
  const regions = wholeFile ? [{ text, index: 0 }] : [...commentRegions(text)];

  for (const region of regions) {
    for (const m of region.text.matchAll(DECISION_CITATION_RE)) {
      violations.push({
        line: lineOf(text, region.index + m.index),
        match: m[0],
        scheme: "[D#]",
      });
    }
    for (const m of region.text.matchAll(SECTION_CITATION_RE)) {
      const before = region.text.slice(Math.max(0, m.index - 40), m.index);
      if (EXTERNAL_STANDARD_BEFORE_RE.test(before)) continue;
      violations.push({
        line: lineOf(text, region.index + m.index),
        match: m[0],
        scheme: "§N",
      });
    }
  }
  return violations;
}

// Git-tracked `*.md` + code files, as absolute paths. Honours `.gitignore`, so
// `archive/` and `node_modules/` fall out for free (same approach as check-doc-links.mjs).
function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((rel) => resolve(root, rel));
}

// Repo-relative display path (falls back to the absolute path when outside `root`, as
// fixture files under a tmpdir are during the co-located test).
function rel(p) {
  return p.startsWith(root) ? p.slice(root.length) : p;
}

async function main() {
  const argv = process.argv.slice(2);
  const files = argv.length
    ? argv.map((p) => (isAbsolute(p) ? p : resolve(p)))
    : trackedFiles();

  const errors = [];
  let scanned = 0;

  for (const abs of files) {
    const relPath = rel(abs);
    if (EXCLUDED.has(relPath)) continue;
    const isMarkdown = MARKDOWN_RE.test(abs);
    const isCode = CODE_RE.test(abs);
    if (!isMarkdown && !isCode) continue;

    const text = await readFile(abs, "utf8").catch(() => null);
    if (text === null) continue;
    scanned++;

    for (const v of findViolations(text, { wholeFile: isMarkdown })) {
      errors.push({ file: relPath, ...v });
    }
  }

  if (errors.length) {
    console.error("retired-citations: FAIL — retired citation(s) found:\n");
    for (const e of errors)
      console.error(`  ${e.file}:${e.line}  ${e.scheme}  "${e.match}"`);
    console.error(
      `\n${errors.length} violation(s). Both the [D#] decision-citation scheme and the ` +
        "§N section-citation scheme are retired — use descriptive names / heading anchors " +
        "instead.",
    );
    process.exit(1);
  }
  console.log(
    `retired-citations: OK — no retired [D#]/§N citations across ${scanned} file(s).`,
  );
  process.exit(0);
}

await main();
