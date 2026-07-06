/**
 * Co-located test for the routing-layer thinness guard (scripts/check-app-routes.mjs).
 *
 * The script takes an optional app-dir path as argv (defaulting to ../src/app), so each
 * test writes a throwaway fixture tree to a tmpdir and runs the real script against it —
 * no copying, mirroring check-retired-citations.test.ts. Runs the script as a child
 * process and asserts on exit code + output; never imports it (it calls process.exit).
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "check-app-routes.mjs");
const REPO_ROOT = join(HERE, "..");

const scratchDirs: string[] = [];

afterEach(() => {
  for (const d of scratchDirs.splice(0))
    rmSync(d, { recursive: true, force: true });
});

/**
 * Writes `files` (keys are paths relative to a fixture app dir) into a fresh tmpdir and
 * runs the real script against it. Returns the child-process result.
 */
function run(files: Record<string, string>) {
  const appDir = mkdtempSync(join(tmpdir(), "app-routes-"));
  scratchDirs.push(appDir);
  for (const [rel, body] of Object.entries(files)) {
    const full = join(appDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return spawnSync(process.execPath, [SCRIPT, appDir], { encoding: "utf8" });
}

describe("check-app-routes.mjs — happy path (real repo)", () => {
  it("passes with exit 0 against the real src/app tree", () => {
    const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(stderr).not.toMatch(/non-route files/);
    expect(stdout).toMatch(/app-routes: OK/);
    expect(status).toBe(0);
  });
});

describe("check-app-routes.mjs — allowed files", () => {
  it("allows the App Router route conventions", () => {
    const { status, stdout } = run({
      "page.tsx": "export default function Page(){ return null }",
      "layout.tsx": "export default function Layout(){ return null }",
      "loading.tsx": "export default function Loading(){ return null }",
      "[slug]/error.tsx":
        "'use client'; export default function E(){ return null }",
      "[slug]/not-found.tsx": "export default function NF(){ return null }",
      "api/thing/route.ts": "export function GET(){}",
      "sitemap.ts": "export default function sitemap(){ return [] }",
      "robots.ts": "export default function robots(){ return {} }",
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/app-routes: OK/);
  });

  it("allows a `*.module.css` anywhere and the root `globals.css`", () => {
    const { status } = run({
      "page.tsx": "export default function Page(){ return null }",
      "page.module.css": ".root { color: red }",
      "deep/nested/Thing.module.css": ".x { color: blue }",
      "globals.css": "@layer foundation {}",
    });
    expect(status).toBe(0);
  });

  it("allows a CSS Module NOT named after a co-located route file (e.g. states.module.css)", () => {
    // Real case: `src/app/[slug]/states.module.css` styles the loading/error/not-found
    // states and has no same-named route file. A `.module.css` is allowed on its own
    // merits (scoped styles), not by matching a route basename.
    const { status } = run({
      "[slug]/loading.tsx": "export default function L(){ return null }",
      "[slug]/states.module.css": ".skeleton { opacity: 0.5 }",
    });
    expect(status).toBe(0);
  });

  it("allows a co-located test whose subject sits beside it", () => {
    const { status } = run({
      "page.tsx": "export default function Page(){ return null }",
      "page.test.tsx": "import './page'; test('x', () => {})",
      "page.integration.test.tsx": "test('y', () => {})",
      "layout.tsx": "export default function Layout(){ return null }",
      "layout.test.ts": "test('z', () => {})",
    });
    expect(status).toBe(0);
  });

  it("allows a route-private helper a co-located route file imports (the escapeXml case)", () => {
    // Next forbids non-handler exports from a `route.ts`, so a route's helper MUST be a
    // separate module; co-locating it is idiomatic. The guard permits it BECAUSE a
    // co-located route file imports it.
    const { status, stdout } = run({
      "rss.xml/route.ts":
        'import { escapeXml } from "./escapeXml";\nexport function GET(){ return escapeXml("a") }',
      "rss.xml/escapeXml.ts":
        "export function escapeXml(s: string){ return s }",
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/app-routes: OK/);
  });

  it("allows a helper imported with an explicit extension (`./escapeXml.ts`)", () => {
    const { status } = run({
      "rss.xml/route.ts":
        'import { escapeXml } from "./escapeXml.ts";\nexport function GET(){ return escapeXml("a") }',
      "rss.xml/escapeXml.ts":
        "export function escapeXml(s: string){ return s }",
    });
    expect(status).toBe(0);
  });

  it("allows a helper imported across a multi-line import clause", () => {
    const { status } = run({
      "rss.xml/route.ts":
        "import {\n  escapeXml,\n  other,\n} from './helpers';\nexport function GET(){ return escapeXml(other) }",
      "rss.xml/helpers.ts":
        "export const escapeXml = (s: string) => s; export const other = '';",
    });
    expect(status).toBe(0);
  });

  it("leaves non-code, non-CSS assets alone (favicon.ico, images, manifest.json)", () => {
    const { status } = run({
      "page.tsx": "export default function Page(){ return null }",
      "favicon.ico": "binary-ish",
      "opengraph-image.png": "png-bytes",
      "manifest.json": "{}",
      "robots.txt": "User-agent: *",
    });
    expect(status).toBe(0);
  });
});

describe("check-app-routes.mjs — violations (the guard bites)", () => {
  it("FAILS on plain (non-module) token CSS like foundation.css", () => {
    const { status, stderr } = run({
      "page.tsx": "export default function Page(){ return null }",
      "foundation.css": ":root { --space-1: 0.25rem }",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/foundation\.css/);
    expect(stderr).toMatch(/src\/styles/);
  });

  it("FAILS a `globals.css` placed in a nested segment (only the root one is allowed)", () => {
    const { status, stderr } = run({
      "page.tsx": "export default function Page(){ return null }",
      "about/globals.css": ".x { color: red }",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/about\/globals\.css/);
  });

  it("FAILS an orphan test whose subject is not co-located (the next-config.test.ts case)", () => {
    const { status, stderr } = run({
      "page.tsx": "export default function Page(){ return null }",
      "next-config.test.ts": "test('build guard', () => {})",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/next-config\.test\.ts/);
    expect(stderr).toMatch(
      /subject `next-config` is not a co-located route file/,
    );
  });

  it("FAILS a stray component not imported by any co-located route file", () => {
    const { status, stderr } = run({
      "about/page.tsx": "export default function Page(){ return null }",
      "about/Button.tsx": "export default function Button(){ return null }",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/Button\.tsx/);
    expect(stderr).toMatch(/non-route module/);
  });

  it("does NOT count an import from a DIFFERENT directory as co-located (precision)", () => {
    // A helper is route-private only if a route file in its OWN directory imports it.
    // An import from a route file one dir up must NOT launder it.
    const { status, stderr } = run({
      "page.tsx":
        'import { h } from "./sub/helper";\nexport default function P(){ return h() }',
      "sub/helper.ts": "export const h = () => null",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/sub\/helper\.ts/);
  });

  it("does NOT let a non-route sibling (non-route file) launder a helper — only route files count", () => {
    // `helper.ts` is imported only by `other.ts`, which is itself a non-route module.
    // Neither is imported by a co-located route file, so BOTH are violations.
    const { status, stderr } = run({
      "seg/route.ts": "export function GET(){}",
      "seg/other.ts": 'import { h } from "./helper";\nexport const other = h',
      "seg/helper.ts": "export const h = 1",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/other\.ts/);
    expect(stderr).toMatch(/helper\.ts/);
  });

  it("reports every violation, not just the first, and exits 1", () => {
    const { status, stderr } = run({
      "foundation.css": ":root { --x: 1 }",
      "helpers.ts": "export const x = 1",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/foundation\.css/);
    expect(stderr).toMatch(/helpers\.ts/);
    expect(stderr).toMatch(/2 violation\(s\)/);
  });
});

describe("check-app-routes.mjs — edge cases", () => {
  it("passes on an app dir containing only route files and assets", () => {
    const { status, stdout } = run({
      "page.tsx": "export default function Page(){ return null }",
      "favicon.ico": "x",
    });
    expect(status).toBe(0);
    expect(stdout).toMatch(/app-routes: OK/);
  });

  it("does not misclassify a route basename that is also a test (route.test.ts is a test, not a route)", () => {
    // `route.test.ts` has basename `route.test`, which is NOT the route convention
    // `route` — it must be treated as a test and require a co-located subject.
    const { status } = run({
      "api/thing/route.ts": "export function GET(){}",
      "api/thing/route.test.ts": "test('x', () => {})",
    });
    expect(status).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Added by independent adversarial QA (qa/app-route-guard). The three FALSE-
// NEGATIVE tests below currently FAIL — they pin real holes where a genuine
// non-route module slips past the guard. The rest lock in verified good behavior.
// ─────────────────────────────────────────────────────────────────────────────

describe("check-app-routes.mjs — QA: false negatives (guard must bite, currently does NOT)", () => {
  it("FAILS on a `.mjs` non-route module (executable code, not an asset)", () => {
    // BUG: only .ts/.tsx/.js/.jsx are treated as code; `.mjs` falls through the
    // `!CODE_EXT.has(ext)` branch and is waved through as a static "asset". A
    // `.mjs` is real ES-module logic — exactly what the guard exists to keep out
    // of the routing layer — and no Next route convention uses `.mjs`.
    const { status, stderr } = run({
      "page.tsx": "export default function Page(){ return null }",
      "helpers.mjs": "export const x = 1",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/helpers\.mjs/);
  });

  it("FAILS on a `.cjs` non-route module (executable code, not an asset)", () => {
    // Same hole as `.mjs`: `.cjs` is CommonJS module code, not a static asset.
    const { status, stderr } = run({
      "page.tsx": "export default function Page(){ return null }",
      "legacy.cjs": "module.exports = { x: 1 }",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/legacy\.cjs/);
  });

  it("does NOT launder a helper merely MENTIONED in a comment/string of a route file", () => {
    // BUG: the relative-specifier regex scans raw file text, so a `./secret`
    // appearing only inside a comment (or a string literal) is counted as an
    // import and "launders" a free-standing module past rule 3. Only a real
    // import should make a helper route-private.
    const { status, stderr } = run({
      "seg/route.ts": '// import x from "./secret"\nexport function GET(){}',
      "seg/secret.ts": "export const s = 1",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/secret\.ts/);
  });
});

describe("check-app-routes.mjs — QA: false-positive guards (must NOT flag valid files)", () => {
  it("allows the metadata-image code generators in .tsx form", () => {
    const { status } = run({
      "icon.tsx": "export default function I(){ return null }",
      "apple-icon.tsx": "export default function A(){ return null }",
      "opengraph-image.tsx": "export default function O(){ return null }",
      "twitter-image.tsx": "export default function T(){ return null }",
      "manifest.ts": "export default function M(){ return {} }",
    });
    expect(status).toBe(0);
  });

  it("allows the remaining route conventions (global-error/forbidden/unauthorized/template/default/proxy/instrumentation/mdx-components)", () => {
    const { status } = run({
      "global-error.tsx": "export default function GE(){ return null }",
      "forbidden.tsx": "export default function F(){ return null }",
      "unauthorized.tsx": "export default function U(){ return null }",
      "template.tsx": "export default function Tp(){ return null }",
      "dash/@modal/default.tsx": "export default function D(){ return null }",
      "proxy.ts": "export default function P(){ return null }",
      "instrumentation.ts": "export function register(){}",
      "instrumentation-client.ts": "export function onError(){}",
      "mdx-components.tsx": "export function useMDXComponents(){ return {} }",
    });
    expect(status).toBe(0);
  });

  it("allows a page inside route-group / parallel / intercepting segments", () => {
    const { status } = run({
      "(marketing)/@modal/(.)photo/[id]/page.tsx":
        "export default function P(){ return null }",
    });
    expect(status).toBe(0);
  });

  it("passes cleanly on an empty app dir", () => {
    const { status, stdout } = run({});
    expect(status).toBe(0);
    expect(stdout).toMatch(/app-routes: OK/);
  });
});

describe("check-app-routes.mjs — deliberately stricter than Next / repo conventions", () => {
  it("FLAGS a component in a Next `_private` folder (repo keeps components in src/)", () => {
    // Next blesses `_folder` co-location, but this repo's routing-thin intent puts
    // components/logic in `src/`, not under `app/`. Locking in that the guard is
    // intentionally stricter — a `_components/*.tsx` is still a violation.
    const { status, stderr } = run({
      "page.tsx": "export default function Page(){ return null }",
      "_components/Button.tsx":
        "export default function Button(){ return null }",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/_components\/Button\.tsx/);
    expect(stderr).toMatch(/non-route module/);
  });

  it("FLAGS a `.spec.` file with a suffix hint (repo standardized on `.test.`, #134)", () => {
    const { status, stderr } = run({
      "page.tsx": "export default function Page(){ return null }",
      "page.spec.tsx": "test('x', () => {})",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/page\.spec\.tsx/);
    expect(stderr).toMatch(/`\.spec\.` suffix/);
  });
});

describe("check-app-routes.mjs — robustness", () => {
  it("does NOT let a specifier inside a block comment launder a helper either", () => {
    // The line-comment case is covered above; this pins the `/* … */` form too.
    const { status, stderr } = run({
      "seg/route.ts": '/* import x from "./secret" */\nexport function GET(){}',
      "seg/secret.ts": "export const s = 1",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/secret\.ts/);
  });

  it("exits non-zero with a clean message when the app dir does not exist", () => {
    const missing = join(tmpdir(), "app-routes-does-not-exist-xyz");
    const { status, stderr } = spawnSync(process.execPath, [SCRIPT, missing], {
      encoding: "utf8",
    });
    expect(status).toBe(1);
    expect(stderr).toMatch(/could not read app dir/);
  });
});
