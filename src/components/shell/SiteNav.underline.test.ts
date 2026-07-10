import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Adversarial QA (#204): the masthead ink rule and the nav active-underline are BOTH the "thick"
 * 2px border. After snapping to `--border-width-thick`, the two must stay EQUAL and the active
 * state must override only the COLOR — if `.active` re-declared border width, or the placeholder
 * and heading widths diverged, activating a link would shift the whole nav row by a pixel.
 */
const css = readFileSync(
  resolve(process.cwd(), "src/components/shell/SiteNav.module.css"),
  "utf8",
);

const rule = (selector: string): string => {
  // Match `selector { ... }` (non-greedy, first brace group). Escapes the leading dot.
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`,
  );
  return css.match(re)?.[1] ?? "";
};

describe("SiteNav border-width-thick pair stays equal — no active-state layout shift", () => {
  it("the masthead heading rule uses --border-width-thick", () => {
    expect(rule(".header")).toMatch(
      /border-bottom:\s*var\(--border-width-thick\)\s+solid/,
    );
  });

  it("the .link underline PLACEHOLDER reserves --border-width-thick (transparent)", () => {
    const link = rule(".link");
    expect(link).toMatch(
      /border-bottom:\s*var\(--border-width-thick\)\s+solid\s+transparent/,
    );
  });

  it("the .active rule overrides ONLY the color, never the border width", () => {
    const active = rule(".active");
    expect(active, "expected an .active rule").not.toBe("");
    expect(active).toMatch(/border-bottom-color:/);
    // The whole failure mode: if .active sets `border-bottom` or `border-bottom-width`, the
    // reserved placeholder width no longer governs and the row can shift on activation.
    expect(active).not.toMatch(/border-bottom-width:/);
    expect(active).not.toMatch(/border-bottom:\s*[^;]*\d/); // no width-bearing shorthand
  });

  it("the masthead hairline stays the THIN (1px) width, distinct from the ink rule", () => {
    expect(rule(".masthead")).toMatch(
      /border-bottom:\s*var\(--border-width\)\s+solid/,
    );
  });
});
