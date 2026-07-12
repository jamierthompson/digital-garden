import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * #203 radius scale: pins the calc-derived token values (`--radius-sm = base − 4px`, etc.) so a
 * change to the scale is a deliberate, reviewed edit rather than a silent drift.
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
