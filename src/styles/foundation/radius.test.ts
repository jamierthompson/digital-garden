import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pins the radius contract: one foundation knob (`--radius-base`), three semantic roles derived
 * from it (`control` / `surface` / `pill`), and a source-tree scan proving no retired scale name
 * (`--radius`, `--radius-sm/-md/-lg/-xl/-full`) survives to resolve as a now-undefined var.
 */
const root = process.cwd();
const read = (rel: string): string => readFileSync(resolve(root, rel), "utf8");

function parseVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of noComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim().replace(/\s+/g, " ");
  }
  return out;
}

const foundation = parseVars(read("src/styles/foundation/radius.css"));
const semantic = parseVars(read("src/styles/semantic/radius.css"));

describe("radius contract — one knob, three roles", () => {
  it("defines the single foundation knob", () => {
    expect(foundation["--radius-base"]).toBe("0.25rem"); // 4px
  });

  it("derives the semantic roles from the knob", () => {
    expect(semantic["--radius-control"]).toBe("var(--radius-base)");
    expect(semantic["--radius-surface"]).toBe("calc(var(--radius-base) * 2)");
    expect(semantic["--radius-pill"]).toBe("9999px");
  });

  it("re-declares the roles at the slot scope so a theme's knob override reaches them", () => {
    // A var() substitutes at the element that DECLARES it — a :root-only role freezes to
    // :root's knob (same mechanism the type roles document in semantic/type.css).
    expect(read("src/styles/semantic/radius.css")).toMatch(
      /:root,\s*:where\(\[data-entry\]\)/,
    );
  });

  it("does NOT re-declare any retired scale name", () => {
    for (const name of [
      "--radius",
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--radius-xl",
      "--radius-full",
    ]) {
      expect(foundation[name], name).toBeUndefined();
      expect(semantic[name], name).toBeUndefined();
    }
  });
});

describe("no retired radius token name survives anywhere in the source tree", () => {
  const tracked = execSync("git ls-files src docs", {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => f.endsWith(".css") || f.endsWith(".md"));

  it("scans a non-trivial set of files (false-green guard)", () => {
    expect(tracked.length).toBeGreaterThan(10);
  });

  it("contains no retired radius token reference", () => {
    const offenders = tracked.filter((f) =>
      /var\(\s*--radius\s*[),]|--radius-(?:sm|md|lg|xl|full)\b/.test(read(f)),
    );
    expect(
      offenders,
      `retired radius name found in: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
