import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { WIDTH_CONTENT } from "./dimension";

/**
 * Pins the width & size token value contract (#202): the lane widths, the WCAG 2.2 SC 2.5.8
 * control-size floor, and a source-tree scan proving no retired width name (`--width-prose` /
 * `--width-text` / `--width-measure` / `--width-page`) survives to resolve as a
 * now-undefined var.
 */
const root = process.cwd();
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

function parseRootVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of noComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const dimension = parseRootVars(read("src/styles/foundation/dimension.css"));

describe("foundation/dimension.css — width & size token contract (#202)", () => {
  it("defines the two lane widths at their intended values", () => {
    expect(dimension["--width-content"]).toBe("42rem"); // the prose lane IS the one reading measure
    expect(dimension["--width-wide"]).toBe("80rem"); // the wide breakout lane
  });

  it("does NOT re-declare any retired width name", () => {
    expect(dimension["--width-prose"]).toBeUndefined();
    expect(dimension["--width-text"]).toBeUndefined();
    expect(dimension["--width-measure"]).toBeUndefined();
    expect(dimension["--width-page"]).toBeUndefined();
  });

  it("defines the new control-size roles at the SC 2.5.8 floor and above", () => {
    expect(dimension["--size-control"]).toBe("1.5rem"); // 24px — WCAG 2.2 SC 2.5.8 floor
    expect(dimension["--size-control-lg"]).toBe("2.75rem"); // 44px
    expect(dimension["--size-icon"]).toBe("1rem"); // 16px
    // The floor token must actually clear 24px, not merely exist.
    expect(
      Number(dimension["--size-control"].replace("rem", "")),
    ).toBeGreaterThanOrEqual(1.5);
  });
});

describe("the --width-content TS mirror", () => {
  // The CSS token is the source of truth; the mirror exists only for markup the browser
  // reads before CSS applies (an img `sizes` attribute). When a design pass retunes the
  // token, this failing is the prompt to update the mirror — never the other way around.
  it("matches the CSS token byte-for-byte", () => {
    expect(WIDTH_CONTENT).toBe(dimension["--width-content"]);
  });
});

describe("no retired width token name survives anywhere in the source tree (#202)", () => {
  const searchDirs = ["src", "docs"];
  const files: string[] = [];
  // Walk the tracked source + docs; a stray old name means a consumer resolves to a now-
  // undefined var (→ silently unset / initial width), the exact double-map failure mode.
  const tracked = execSync("git ls-files " + searchDirs.join(" "), {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => f.endsWith(".css") || f.endsWith(".md"));
  files.push(...tracked);

  it("scans a non-trivial set of files (false-green guard)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("contains no retired width token reference", () => {
    const offenders = files.filter((f) =>
      /--width-prose|--width-text|--width-measure|--width-page/.test(read(f)),
    );
    expect(
      offenders,
      `retired token name found in: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
