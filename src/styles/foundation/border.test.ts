import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Adversarial QA (#204 border-width scale): pins the new token values and proves every migrated
 * consumer reads the TOKEN, not the raw literal it replaced — a snap that silently left a literal
 * behind (or mapped to the wrong width) would drift the geometry with no lint/type error. Border
 * COLORS are out of scope here (owned by #201); this file only touches border WIDTH geometry.
 */
const root = process.cwd();
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

function parseRootVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of noComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim().replace(/\s+/g, " ");
  }
  return out;
}

const border = parseRootVars(read("src/styles/foundation/border.css"));

describe("foundation/border.css — border-width scale contract (#204)", () => {
  it("defines base and thick border widths", () => {
    expect(border["--border-width"]).toBe("1px");
    expect(border["--border-width-thick"]).toBe("2px");
  });
});

describe("every snapped consumer reads the border-width token, not a raw literal (#204)", () => {
  // file → declaration fragment that MUST now be present (token form). If a snap regressed to a
  // literal, the fragment would be absent and the case goes red.
  const cases: Array<[string, RegExp]> = [
    // Border-width snaps (base)
    [
      "src/app/[slug]/states.module.css",
      /border:\s*var\(--border-width\)\s+solid/,
    ],
    [
      "src/app/browse/page.module.css",
      /border-bottom:\s*var\(--border-width\)\s+solid/,
    ],
    [
      "src/components/shell/SiteFooter.module.css",
      /border-top:\s*var\(--border-width\)\s+solid/,
    ],
    [
      "src/components/entry/RelatedEntries.module.css",
      /border-top:\s*var\(--border-width\)\s+solid/,
    ],
    [
      "src/components/ui/Switch.module.css",
      /border:\s*var\(--border-width\)\s+solid/,
    ],
    // Border-width snaps (thick) — the SiteNav ink pair
    [
      "src/components/shell/SiteNav.module.css",
      /border-bottom:\s*var\(--border-width-thick\)\s+solid\s+var\(--foreground\)/,
    ],
    [
      "src/components/shell/SiteNav.module.css",
      /border-bottom:\s*var\(--border-width-thick\)\s+solid\s+transparent/,
    ],
  ];

  for (const [file, re] of cases) {
    it(`${file} :: ${re.source}`, () => {
      expect(read(file)).toMatch(re);
    });
  }
});
