import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// #147 — the entry-page h1 must render in the DISPLAY face, the same way the homepage h1 does,
// via the SHARED `--font-display` token so the two can never drift. jsdom applies no CSS-module
// font-family, so the browser check proves the RENDER; this pins the CONTRACT: both `.title`
// rules bind `--font-display` (a token, never a hardcoded family).

/** True when the FIRST `.title { … }` rule in `cssPath` binds `font-family: var(--font-display)`. */
function titleBindsDisplayFont(cssPath: string): boolean {
  const css = readFileSync(cssPath, "utf8");
  const rule = css.match(/\.title\s*\{([^}]*)\}/);
  return !!rule && /font-family:\s*var\(--font-display\)/.test(rule[1]);
}

describe("#147 — entry h1 shares the homepage display font", () => {
  it("binds --font-display in BOTH the homepage and the entry .title (can't drift)", () => {
    // Vitest runs from the repo root, so resolve both stylesheets relative to cwd.
    // Entry page — the fix.
    expect(titleBindsDisplayFont("src/app/[slug]/page.module.css")).toBe(true);
    // Homepage — the reference it must match.
    expect(titleBindsDisplayFont("src/app/page.module.css")).toBe(true);
  });
});
