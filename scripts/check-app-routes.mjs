// Routing-layer thinness guard (`pnpm lint:routes`).
//
// `src/app/` is the routing layer: it holds Next.js route files and the assets
// co-located with them — NOT free-standing logic, components, design-system CSS,
// or config-guard tests. Those recurrently drift in (`foundation.css`,
// `foundation.test.ts`, `next-config.test.ts` — all since relocated) and only
// manual review caught them, so they kept slipping back. This guard makes the
// drift structurally impossible: real logic lives in `src/` modules, styles in
// `src/styles/`, tests beside their subject.
//
// A file under `src/app/` is allowed only if it is one of:
//   1. A route-convention CODE file — basename ∈ ROUTE_BASENAMES with a code
//      extension (`.ts|.tsx|.js|.jsx|.mjs|.cjs|.mts|.cts`). The basename list is the
//      App Router file conventions from the version-exact bundled docs
//      (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/),
//      NOT memory — page/layout/loading/error/not-found/route/template/… plus the
//      metadata code conventions (sitemap/robots/manifest/opengraph-image/…). No
//      route convention uses `.mjs`/`.cjs`, so those extensions only ever reach the
//      non-route verdict — module code, enforced, never waved through as an asset.
//   2. A co-located TEST — `*.test.*` / `*.integration.test.*` (this repo's only
//      test suffixes, per #134 — a `.spec.*` file is NOT recognized) whose subject
//      file sits in the SAME directory (e.g. `page.test.tsx` beside `page.tsx`,
//      `escapeXml.test.ts` beside `escapeXml.ts`). A test whose subject is NOT
//      co-located (e.g. `next-config.test.ts`, testing root config) belongs beside
//      its subject in `src/` — that's a violation.
//   3. A route-private HELPER — a non-route code module that a co-located route
//      file imports via a relative specifier. Next only allows HTTP-method/config
//      exports from a `route.ts`, so a route's helpers MUST be separate modules;
//      co-locating them is idiomatic (`app/rss.xml/escapeXml.ts` ← `route.ts`).
//      A module NOT imported by any co-located route file is free-standing logic
//      or a shared component → it belongs in a `src/` module. Comments are stripped
//      before the import scan, so a specifier appearing only in a comment cannot
//      launder a module through.
//   4. A CSS Module — `*.module.css` (scoped component styles), anywhere; or the
//      single root `globals.css`. Any OTHER plain `.css` is design-system / token
//      CSS that belongs in `src/styles/`.
//   5. A non-code, non-CSS asset — images, `favicon.ico`, `manifest.json`,
//      `robots.txt`, `sitemap.xml`, fonts, etc. These are legitimate route/metadata
//      static assets and are left alone (only the code extensions above and `.css`
//      are enforced).
//
// Intentionally STRICTER than Next: Next blesses `_private` folders for co-locating
// components under `app/`, but this repo keeps components and logic in `src/` — so a
// module in `app/_components/` is still flagged. The routing layer holds route files
// and their co-located tests/helpers/assets, nothing else.
//
// Enumeration is a recursive walk of `src/app/`; pass an explicit directory as
// argv to scan a fixture tree instead (used by the co-located test).

import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// App Router file conventions (bundled docs, file-conventions + metadata dirs).
// Basenames only — the extension is checked separately. `favicon` is intentionally
// absent: `favicon.ico` is an asset (rule 5), not a code convention.
const ROUTE_BASENAMES = new Set([
  "page",
  "layout",
  "loading",
  "error",
  "global-error",
  "not-found",
  "forbidden",
  "unauthorized",
  "route",
  "template",
  "default",
  // Root-level conventions that live in the app dir.
  "instrumentation",
  "instrumentation-client",
  "mdx-components",
  "proxy",
  // Metadata conventions (may be dynamic code OR static assets; the code form
  // lands here, the static form is an asset handled by rule 5).
  "sitemap",
  "robots",
  "manifest",
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
]);

// Every executable-module extension. No Next route convention uses `.mjs`/`.cjs`
// (or the type-declaring `.mts`/`.cts`), but they ARE module code — treating them
// as inert assets would let real logic slip in, so they're enforced like `.ts`.
const CODE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);
const TEST_RE = /\.(?:integration\.)?test$/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Strip the code extension, then a trailing `.test` / `.integration.test`, to get
// the subject basename a test covers. `page.integration.test.tsx` → `page`.
function subjectOf(fileBase) {
  return fileBase.replace(TEST_RE, "");
}

// Strip block + line comments so a relative specifier that appears only inside a
// comment can't be mistaken for a real import (rule-3 laundering). A lightweight
// heuristic, not a tokenizer: the `(?<!:)` guard keeps a `//` inside a `://` URL
// scheme from eating the rest of its line. Good enough for a guard — it need not be
// a full parser (a specifier hidden in a non-URL string literal is a residual, rare
// blind spot, out of scope here).
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");
}

// Does `routeFileText` import `targetPath` (extension-insensitive) via a relative
// specifier? Matches `import … from "./x"`, `export … from "./x"`, and
// `import("./x")` — the specifier is on the `from`/`import(` token regardless of
// how the clause wraps, so a single global regex over the file text is robust to
// multi-line import clauses. Comments are stripped first so they can't launder a
// specifier.
const RELATIVE_SPECIFIER_RE = /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g;

function routeFileImports(routeFileText, routeDir, targetPath) {
  const text = stripComments(routeFileText);
  const targetNoExt = targetPath.slice(0, -extname(targetPath).length);
  for (const m of text.matchAll(RELATIVE_SPECIFIER_RE)) {
    const resolved = resolve(routeDir, m[1]);
    const resolvedNoExt = resolved.slice(
      0,
      resolved.length - extname(resolved).length,
    );
    // Compare with and without extension so `./escapeXml` and `./escapeXml.ts`
    // both match the file `escapeXml.ts`.
    if (resolved === targetPath || resolvedNoExt === targetNoExt) return true;
  }
  return false;
}

// Route-convention code files that sit in `dir`, as absolute paths. Used to decide
// whether a non-route helper in the same dir is route-private (rule 3).
function coLocatedRouteFiles(dir, allFiles) {
  return allFiles.filter((f) => {
    if (dirname(f) !== dir) return false;
    const ext = extname(f);
    if (!CODE_EXT.has(ext)) return false;
    const base = basename(f, ext);
    return ROUTE_BASENAMES.has(base) && !TEST_RE.test(base);
  });
}

function classify(file, allFiles, appDir) {
  const ext = extname(file);
  const dir = dirname(file);

  if (ext === ".css") {
    if (file.endsWith(".module.css")) return null;
    // The single root global sheet is allowed; any other plain `.css` is token /
    // design-system CSS that belongs in `src/styles/`.
    if (basename(file) === "globals.css" && dir === appDir) return null;
    return "plain (non-module) CSS — move design-system/token styles to `src/styles/` (only `*.module.css` and the root `globals.css` belong under `src/app/`)";
  }

  if (!CODE_EXT.has(ext)) return null; // static/metadata asset — left alone.

  const fileBase = basename(file, ext);

  // Rule 1 — a route-convention file.
  if (ROUTE_BASENAMES.has(fileBase) && !TEST_RE.test(fileBase)) return null;

  // Rule 2 — a co-located test whose subject sits beside it.
  if (TEST_RE.test(fileBase)) {
    const subject = subjectOf(fileBase);
    const hasSubject = allFiles.some(
      (f) =>
        dirname(f) === dir &&
        CODE_EXT.has(extname(f)) &&
        basename(f, extname(f)) === subject,
    );
    if (hasSubject) return null;
    return `test whose subject \`${subject}\` is not a co-located route file — move it beside its subject in \`src/\` (a config/logic test does not belong in the routing layer)`;
  }

  // A `.spec.*` file uses a test suffix this repo doesn't use (#134 standardized on
  // `.test.` / `.integration.test.`). Give the suffix hint rather than the generic
  // non-route message.
  if (/\.spec$/.test(fileBase)) {
    return "test file uses the `.spec.` suffix — this repo's tests are `*.test.*` / `*.integration.test.*` (see #134); rename it, and it must sit beside its subject";
  }

  // Rule 3 — a route-private helper a co-located route file imports.
  for (const routeFile of coLocatedRouteFiles(dir, allFiles)) {
    if (routeFileImports(readFileSync(routeFile, "utf8"), dir, file))
      return null;
  }

  return "non-route module — real logic and shared components live in `src/` modules, not the routing layer (only route files and the private helpers a co-located route imports belong under `src/app/`)";
}

function main() {
  const argv = process.argv.slice(2);
  const appDir = argv[0]
    ? resolve(argv[0])
    : fileURLToPath(new URL("../src/app", import.meta.url));

  let allFiles;
  try {
    allFiles = walk(appDir);
  } catch (err) {
    console.error(
      `app-routes: could not read app dir \`${appDir}\` (${err.message}).`,
    );
    process.exit(1);
  }

  const violations = [];
  for (const file of allFiles) {
    const reason = classify(file, allFiles, appDir);
    if (reason)
      violations.push(`${relative(process.cwd(), file)}\n      ↳ ${reason}`);
  }

  if (violations.length) {
    console.error("app-routes: non-route files under `src/app/`:\n");
    for (const v of violations) console.error(`  ${v}`);
    console.error(
      `\n${violations.length} violation(s). Keep the routing layer thin — see the routing-thin guard in docs/architecture.md.`,
    );
    process.exit(1);
  }
  console.log(
    `app-routes: OK — every file under src/app/ is a route file, a co-located test/helper, or an allowed asset (${allFiles.length} scanned).`,
  );
  process.exit(0);
}

main();
