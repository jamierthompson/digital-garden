import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { THEME_TOKEN_NAMES } from "@garden/oklch";

import { TEXT_COLORS } from "./textColor";

/**
 * Executable contract between the `color` prop and its shared CSS: every `TextColor` value has
 * exactly one `data-color` rule binding `color` to the semantic token of the SAME name, and the
 * sheet carries no ink the prop can't reach (bijection — a value added on one side only goes red).
 */
const SHEET = readFileSync(
  resolve(process.cwd(), "src/components/typography/textColor.module.css"),
  "utf8",
);

const WITHOUT_COMMENTS = SHEET.replace(/\/\*[\s\S]*?\*\//g, "");

const RULES = [
  ...WITHOUT_COMMENTS.matchAll(
    /\[data-color="([a-z-]+)"\]\s*\{\s*color:\s*var\(--([a-z-]+)\);\s*\}/g,
  ),
].map((m) => ({ selectorValue: m[1], token: m[2] }));

describe("textColor.module.css IS the TextColor contract", () => {
  it("declares its @layer (an unlayered module outranks every layered rule)", () => {
    expect(WITHOUT_COMMENTS).toMatch(/@layer components\s*\{/);
  });

  it("carries exactly one rule per TextColor value and none the prop can't reach", () => {
    expect(RULES.map((r) => r.selectorValue).sort()).toEqual(
      [...TEXT_COLORS].sort(),
    );
  });

  for (const color of TEXT_COLORS) {
    it(`binds data-color="${color}" to var(--${color}) — same-name token, nothing else`, () => {
      const rule = RULES.find((r) => r.selectorValue === color);
      expect(rule?.token).toBe(color);
    });
  }

  it("every TextColor names a REAL engine token (THEME_TOKEN_NAMES) — no ink can resolve to nothing", () => {
    // The bijection above only pins prop ⇄ sheet. This pins both to the engine's canonical token
    // contract: a rename/removal in `@garden/oklch` would otherwise leave `var(--<role>)` unset
    // and the ink silently falling back to inherited color.
    for (const color of TEXT_COLORS) {
      expect(THEME_TOKEN_NAMES).toContain(color);
    }
  });

  it("every data-color rule is scoped to the local .ink class — no bare-attribute leak", () => {
    // A selector like `[data-color="x"]` (without `.ink`) would pass the bijection but paint ANY
    // element carrying that data attribute, escaping the primitives' contract.
    const selectors = [...WITHOUT_COMMENTS.matchAll(/([^{}]+)\{/g)]
      .map((m) => m[1].trim())
      .filter((sel) => sel.includes("data-color"));
    expect(selectors.length).toBe(TEXT_COLORS.length);
    for (const sel of selectors) {
      expect(sel).toMatch(/^\.[a-zA-Z][\w-]*\[data-color="[a-z-]+"\]$/);
    }
  });
});
