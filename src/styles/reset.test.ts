import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The base `h1`–`h6` rule is the ONE place headings bind the display face. Pinned here so the drift
 * it guards — a heading forgetting `--font-heading` and inheriting the body serif — is impossible.
 */
const CODE = readFileSync(
  resolve(process.cwd(), "src/styles/reset.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

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

/**
 * The `[data-entry]` body baseline is the ONE place a themed slot re-reads `--font-body` so plain
 * slot prose repaints in the entry's authored body face (reset.css resolves the token once on
 * `<body>`, so descendants inherit the resolved family, not the live token). It's a STATIC rule —
 * the string is identical for every entry; `EntryScope` supplies only the per-entry token values.
 * Pinned here so dropping it (and silently reverting to invisible body theming) is impossible.
 */
describe("reset.css themed-slot body baseline rule", () => {
  const slotRule = CODE.match(/\[data-entry\]\s*\{([^}]*)\}/);

  it("binds --font-body on [data-entry]", () => {
    expect(slotRule).not.toBeNull();
    expect(/font-family:\s*var\(--font-body\)/.test(slotRule![1])).toBe(true);
  });
});
