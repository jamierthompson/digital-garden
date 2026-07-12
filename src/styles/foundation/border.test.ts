import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins the border-width scale token values (#204). Border COLORS are out of scope here
 * (owned by #201); this file only touches border WIDTH geometry.
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
