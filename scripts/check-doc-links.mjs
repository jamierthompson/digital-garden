// Markdown link & anchor checker (part of `pnpm lint:docs`).
//
// Nothing else in the gate validates Markdown links, so broken relative links,
// dead intra-doc `#anchor`s, and links into moved/deleted files rot silently and
// never turn CI red. This walks every git-tracked `*.md` (so the gitignored
// `archive/` and `node_modules/` fall out for free) and fails on:
//   - a relative link/image whose target file or directory doesn't exist
//   - a `#anchor` (same-file, or `path#anchor` into another tracked `.md`) whose
//     heading slug doesn't exist
// External URLs (http(s):, mailto:, tel:, protocol-relative `//`) are skipped by
// design — no network in the gate. Heading slugs use `github-slugger`, the same
// algorithm GitHub renders anchors with, so anchor checks match what actually
// resolves on the rendered docs.
//
// Enumeration is `git ls-files` by default; pass explicit file paths as argv to
// check a subset (used by the co-located test to run against fixture trees).
//
// Known limitations (intentional — this is a lightweight guard, not a CommonMark
// parser): only inline `[text](target)` / `![alt](target)` links are parsed —
// reference-style (`[t][ref]`), HTML `<a href>`/`<img src>`, and angle-bracket/
// autolink destinations are not. Top-level 4-space indented code blocks and Setext
// (`===`/`---` underline) headings are not recognized. The tracked docs use none of
// these today; extend the parser here if that changes.

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";
import GithubSlugger from "github-slugger";

const root = fileURLToPath(new URL("../", import.meta.url));

// Git-tracked markdown, as absolute paths. `git ls-files '*.md'` matches at any
// depth and honours `.gitignore`, so `archive/` and `node_modules/` are excluded.
function trackedMarkdown() {
  return execFileSync("git", ["ls-files", "*.md"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((rel) => resolve(root, rel));
}

// Replace fenced code blocks (``` / ~~~) with equal-length blanks, preserving
// newlines and offsets. Inline code is left intact — it carries real heading text
// (e.g. a heading "The `@layer` trap" slugs from the words inside the backticks).
function blankFences(md) {
  let fence = null; // the active fence marker, or null
  return md
    .split("\n")
    .map((line) => {
      const open = line.match(/^\s*(```+|~~~+)/);
      if (fence) {
        const close = line.match(/^\s*(```+|~~~+)\s*$/);
        const blanked = " ".repeat(line.length);
        if (
          close &&
          close[1][0] === fence[0] &&
          close[1].length >= fence.length
        )
          fence = null;
        return blanked;
      }
      if (open) {
        fence = open[1];
        return " ".repeat(line.length);
      }
      return line;
    })
    .join("\n");
}

// Fences AND inline code spans blanked — so a `[x](y)` shown inside example code
// is not mistaken for a real link. Used for the link scan, not heading slugs.
// The inline pattern is newline-bounded (`[^\`\n]*`): an unbalanced/stray backtick
// swallows only to end-of-line, never across paragraphs — otherwise a lone backtick
// would silently blank a whole region and hide any real (broken) link inside it.
function blankCode(md) {
  return blankFences(md).replace(/`+[^`\n]*`+/g, (m) => " ".repeat(m.length));
}

// Strip inline markdown from heading text so the slug matches GitHub's: images
// dropped, links reduced to their text, emphasis/code marks and stray HTML removed.
function headingText(raw) {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s*#+\s*$/, "") // closing ATX hashes
    .trim();
}

// The set of heading-anchor slugs a rendered `.md` exposes.
function headingSlugs(md) {
  const slugger = new GithubSlugger();
  const slugs = new Set();
  for (const line of blankFences(md).split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) slugs.add(slugger.slug(headingText(m[2])));
  }
  return slugs;
}

const isExternal = (t) => /^(https?:|mailto:|tel:|data:|\/\/)/i.test(t);

// GitHub percent-decodes link paths (`./my%20file.md` → `./my file.md`); decode
// before resolving on disk. Fall back to the raw path if it isn't valid encoding.
function safeDecode(p) {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

// `[text](target)` and `![alt](target)` — target is the first non-space,
// non-paren run (an optional "title" and trailing `)` are left off).
const LINK_RE = /!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*"|\s+'[^']*')?\s*\)/g;

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

async function main() {
  const argv = process.argv.slice(2);
  const files = argv.length
    ? argv.map((p) => (isAbsolute(p) ? p : resolve(p)))
    : trackedMarkdown();

  // Cache heading slugs per file so cross-file anchor checks read each target once.
  const slugCache = new Map();
  async function slugsFor(absPath) {
    if (slugCache.has(absPath)) return slugCache.get(absPath);
    const set = existsSync(absPath)
      ? headingSlugs(await readFile(absPath, "utf8"))
      : null;
    slugCache.set(absPath, set);
    return set;
  }

  const errors = [];
  let linkCount = 0;

  for (const file of files) {
    const raw = await readFile(file, "utf8").catch(() => null);
    if (raw === null) {
      errors.push({ file, line: 0, target: "", reason: "could not read file" });
      continue;
    }
    slugCache.set(file, headingSlugs(raw));
    const scan = blankCode(raw);
    const dir = dirname(file);

    for (const m of scan.matchAll(LINK_RE)) {
      const target = m[1];
      if (isExternal(target)) continue;
      linkCount++;
      const line = lineOf(scan, m.index);
      const [pathPart, anchor] = splitAnchor(target);

      // Pure same-file anchor: `#section`. Anchor comparison is case-sensitive
      // against github-slugger's lowercase output — GitHub emits a lowercase id, so
      // `#Mixed-Case` genuinely does not resolve. Intentional; relaxing it to
      // case-insensitive would turn a real broken anchor into a silent pass.
      if (pathPart === "") {
        if (anchor === "") continue; // bare `#` — top of page
        const slugs = await slugsFor(file);
        if (slugs && !slugs.has(anchor))
          errors.push({
            file,
            line,
            target,
            reason: `no heading anchor "#${anchor}" in this file`,
          });
        continue;
      }

      // Relative link to a file/dir (leading `/` → repo-root-relative).
      const decoded = safeDecode(pathPart);
      const abs = decoded.startsWith("/")
        ? resolve(root, `.${decoded}`)
        : resolve(dir, decoded);
      if (!existsSync(abs)) {
        errors.push({
          file,
          line,
          target,
          reason: "target file does not exist",
        });
        continue;
      }
      // Cross-file anchor into another markdown file.
      if (anchor && /\.md$/i.test(abs) && statSync(abs).isFile()) {
        const slugs = await slugsFor(abs);
        if (slugs && !slugs.has(anchor))
          errors.push({
            file,
            line,
            target,
            reason: `no heading anchor "#${anchor}" in ${rel(abs)}`,
          });
      }
    }
  }

  if (errors.length) {
    console.error(`doc-links: FAIL — ${errors.length} broken link(s):`);
    for (const e of errors)
      console.error(
        `  ${rel(e.file)}:${e.line}  →  ${e.target || "(file)"}  (${e.reason})`,
      );
    process.exit(1);
  }
  console.log(
    `doc-links: OK — ${linkCount} internal link(s) across ${files.length} file(s), all resolve.`,
  );
  process.exit(0);
}

// Split `path#anchor` on the FIRST `#`. `#anchor` → ["", "anchor"].
function splitAnchor(target) {
  const i = target.indexOf("#");
  if (i === -1) return [target, ""];
  return [target.slice(0, i), target.slice(i + 1)];
}

// Repo-relative display path (defined here so it's in scope for main()).
function rel(p) {
  return p.startsWith(root) ? p.slice(root.length) : p;
}

await main();
