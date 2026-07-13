import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
});
