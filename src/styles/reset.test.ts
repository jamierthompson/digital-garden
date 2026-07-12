import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The base `h1`–`h6` rule is the ONE place headings bind the display face. Pinned here so the drift
 * it guards — a heading forgetting `--font-heading` and inheriting the body serif — is impossible.
 */
const RAW = readFileSync(
  resolve(process.cwd(), "src/styles/reset.css"),
  "utf8",
);
const CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

describe("reset.css cascade layer", () => {
  it("wraps its rules in `@layer base` so they lose to component modules", () => {
    expect(CODE).toMatch(/@layer\s+base\s*\{/);
  });

  it("declares no retired `@layer foundation`/`@layer semantic`", () => {
    expect(CODE).not.toMatch(/@layer\s+(foundation|semantic)\b/);
  });
});

describe("reset.css base heading element rule", () => {
  const headingRule = CODE.match(
    /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{([^}]*)\}/,
  );

  it("binds --font-heading on h1–h6", () => {
    expect(headingRule).not.toBeNull();
    expect(/font-family:\s*var\(--font-heading\)/.test(headingRule![1])).toBe(
      true,
    );
  });
});
