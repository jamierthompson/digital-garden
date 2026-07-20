import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SHEET = readFileSync(
  resolve(process.cwd(), "src/styles/semantic/typography.css"),
  "utf8",
);

describe("semantic/typography.css house faces", () => {
  it.each([
    ["--font-body", "--font-newsreader"],
    ["--font-heading", "--font-newsreader"],
    ["--font-ui", "--font-instrument-sans"],
    ["--font-mono", "--font-geist-mono"],
  ])("%s maps to %s", (token, nextFontVar) => {
    const decl = SHEET.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))?.[1];
    expect(decl, `expected ${token} declared`).toBeDefined();
    expect(decl).toContain(nextFontVar);
  });

  it("the editorial voice is one family: heading and body read the same face", () => {
    const face = (token: string) =>
      SHEET.match(
        new RegExp(`${token}\\s*:\\s*var\\((--font-[a-z-]+)\\)`),
      )?.[1];
    expect(face("--font-heading")).toBe(face("--font-body"));
  });
});
