import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Adversarial QA (#202): the width rename is a DOUBLE-MAP — `--width-content` was both renamed
 * away (old 72rem → `--width-page`) AND its name reused for a different value (old `--width-text`
 * 48rem → new `--width-content`). A wrong migration would silently hand a consumer the wrong
 * width with no type/lint error. These tests pin (a) the new token values, (b) that no old name
 * survives, and (c) that every migrated consumer resolves to its HISTORICAL rem value.
 */
const root = process.cwd();
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

function parseRootVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of noComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const dimension = parseRootVars(read("src/styles/foundation/dimension.css"));

describe("foundation/dimension.css — width & size token contract (#202)", () => {
  it("defines the renamed width scale at its intended values", () => {
    expect(dimension["--width-measure"]).toBe("42rem"); // was --width-prose
    expect(dimension["--width-content"]).toBe("48rem"); // was --width-text (NAME REUSED)
    expect(dimension["--width-page"]).toBe("72rem"); // was --width-content
  });

  it("does NOT re-declare any retired width name", () => {
    expect(dimension["--width-prose"]).toBeUndefined();
    expect(dimension["--width-text"]).toBeUndefined();
  });

  it("defines the new control-size roles at the SC 2.5.8 floor and above", () => {
    expect(dimension["--size-control"]).toBe("1.5rem"); // 24px — WCAG 2.2 SC 2.5.8 floor
    expect(dimension["--size-control-lg"]).toBe("2.75rem"); // 44px
    expect(dimension["--size-icon"]).toBe("1rem"); // 16px
    // The floor token must actually clear 24px, not merely exist.
    expect(
      Number(dimension["--size-control"].replace("rem", "")),
    ).toBeGreaterThanOrEqual(1.5);
  });
});

describe("no retired width token name survives anywhere in the source tree (#202)", () => {
  const searchDirs = ["src", "docs"];
  const files: string[] = [];
  // Walk the tracked source + docs; a stray old name means a consumer resolves to a now-
  // undefined var (→ silently unset / initial width), the exact double-map failure mode.
  const tracked = execSync("git ls-files " + searchDirs.join(" "), {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => f.endsWith(".css") || f.endsWith(".md"));
  files.push(...tracked);

  it("scans a non-trivial set of files (false-green guard)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("contains no --width-prose or --width-text reference", () => {
    const offenders = files.filter((f) =>
      /--width-prose|--width-text/.test(read(f)),
    );
    expect(
      offenders,
      `retired token name found in: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("every width consumer resolves to its HISTORICAL rem value (#202)", () => {
  // The token is the NEW name; the rem is what the consumer rendered at BEFORE the rename. If the
  // double-map slipped, the token here would map to a different rem and the table would go red.
  const val = (token: string): string =>
    dimension[`--${token.replace(/^--/, "")}`];

  // (a) CSS files that still consume a --width-* token directly — the ones NOT migrated onto the
  // `Page` primitive's frame (#207): the cold-state frames, the shell chrome, the [slug] article
  // grid's own reading-measure columns, and Page's own conduit fallback.
  const cssCases: Array<[string, string, string, string]> = [
    // [slug]/page.module.css keeps the article grid's reading-measure column + the non-article
    // child cap; the frame's own max-width moved onto <Page> (#207).
    [
      "src/app/[slug]/page.module.css",
      "min(var(--width-content), 100%)",
      "width-content",
      "48rem",
    ],
    // The Page primitive's frame — the single consumer the six migrated routes now share, via the
    // --page-width conduit with a --width-content fallback.
    [
      "src/components/layout/Page.module.css",
      "var(--page-width, var(--width-content))",
      "width-content",
      "48rem",
    ],
    [
      "src/app/loading.module.css",
      "max-width: var(--width-measure)",
      "width-measure",
      "42rem",
    ],
    [
      "src/app/[slug]/states.module.css",
      "max-width: var(--width-measure)",
      "width-measure",
      "42rem",
    ],
    [
      "src/components/shell/SiteNav.module.css",
      "max-width: var(--width-page)",
      "width-page",
      "72rem",
    ],
    [
      "src/components/shell/SiteFooter.module.css",
      "max-width: var(--width-page)",
      "width-page",
      "72rem",
    ],
  ];

  for (const [file, fragment, token, rem] of cssCases) {
    it(`${file} :: ${fragment} → ${rem}`, () => {
      const css = read(file);
      expect(css, `expected "${fragment}" in ${file}`).toContain(fragment);
      expect(val(token), `--${token} must resolve to ${rem}`).toBe(rem);
    });
  }

  // (b) The six route frames migrated onto <Page width=…> (#207): the historical frame width is
  // now selected by the `width` role prop, which Page maps to var(--width-<role>). Pin each route
  // to the role that PRESERVES its pre-migration rem — a wrong role would silently reflow the page.
  const routeCases: Array<[string, string, string, string]> = [
    ["src/app/page.tsx", "page", "width-page", "72rem"],
    ["src/app/browse/page.tsx", "page", "width-page", "72rem"],
    ["src/app/now/page.tsx", "content", "width-content", "48rem"],
    ["src/app/about/page.tsx", "measure", "width-measure", "42rem"],
    ["src/app/system/page.tsx", "measure", "width-measure", "42rem"],
    ["src/app/[slug]/page.tsx", "page", "width-page", "72rem"],
  ];

  for (const [file, role, token, rem] of routeCases) {
    it(`${file} :: <Page width="${role}"> → ${rem}`, () => {
      const src = read(file);
      expect(src, `expected <Page width="${role}"> in ${file}`).toContain(
        `<Page width="${role}"`,
      );
      expect(val(token), `--${token} must resolve to ${rem}`).toBe(rem);
    });
  }
});
