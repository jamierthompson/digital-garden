import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Adversarial QA (#203 radius scale): pins the new token values and proves every migrated
 * consumer reads the TOKEN, not the raw literal it replaced — a snap that silently left a literal
 * behind (or mapped to the wrong step) would drift the geometry with no lint/type error. Border
 * geometry is guarded in border.test.ts; radius COLORS are out of scope (owned by #201).
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

const radius = parseRootVars(read("src/styles/foundation/radius.css"));

describe("foundation/radius.css — radius scale contract (#203)", () => {
  it("defines the calc-derived radius scale from a single --radius base", () => {
    expect(radius["--radius"]).toBe("0.625rem"); // 10px
    expect(radius["--radius-sm"]).toBe("calc(var(--radius) - 4px)"); // 6px
    expect(radius["--radius-md"]).toBe("calc(var(--radius) - 2px)"); // 8px
    expect(radius["--radius-lg"]).toBe("var(--radius)"); // 10px
    expect(radius["--radius-xl"]).toBe("calc(var(--radius) + 4px)"); // 14px
    expect(radius["--radius-full"]).toBe("9999px");
  });
});

describe("every snapped consumer reads the radius token, not a raw literal (#203)", () => {
  // file → declaration fragment that MUST now be present (token form). If a snap regressed to a
  // literal, the fragment would be absent and the case goes red.
  const cases: Array<[string, RegExp]> = [
    ["src/app/[slug]/states.module.css", /border-radius:\s*var\(--radius-md\)/],
    ["src/app/browse/page.module.css", /border-radius:\s*var\(--radius-full\)/],
    [
      "src/components/entry/EntryCard.module.css",
      /border-radius:\s*var\(--radius-lg\)/,
    ],
    [
      "src/components/portable-text/EntryFigure.module.css",
      /border-radius:\s*var\(--radius-md\)/,
    ],
    [
      "src/components/portable-text/MissingEmbed.module.css",
      /border-radius:\s*var\(--radius-md\)/,
    ],
    [
      "src/components/ui/Switch.module.css",
      /border-radius:\s*var\(--radius-full\)/,
    ],
  ];

  for (const [file, re] of cases) {
    it(`${file} :: ${re.source}`, () => {
      expect(read(file)).toMatch(re);
    });
  }
});
