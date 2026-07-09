import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SHEET = readFileSync(
  resolve(process.cwd(), "src/styles/semantic/typography.css"),
  "utf8",
);

describe("semantic/typography.css house faces", () => {
  it.each([
    ["--font-body", "--font-source-serif-4"],
    ["--font-heading", "--font-space-grotesk"],
    ["--font-mono", "--font-jetbrains-mono"],
  ])("%s maps to %s", (token, nextFontVar) => {
    const decl = SHEET.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))?.[1];
    expect(decl, `expected ${token} declared`).toBeDefined();
    expect(decl).toContain(nextFontVar);
  });
});
