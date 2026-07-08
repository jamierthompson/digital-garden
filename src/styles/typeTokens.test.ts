import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildTypeScale, typeScaleToDeclarations } from "@garden/type";

/**
 * Guard for the type scale baked into `src/styles/foundation.css`.
 *
 * The `--type-size-1 … N` ramp is the COMPLETE output of `@garden/type`'s default scale, baked as
 * static `clamp()` literals (the global scale is not per-entry runtime-varying, unlike color). This
 * suite is the executable RECEIPT — the same bake-and-guard pattern `foundation.test.ts` uses for
 * color: it re-derives the ramp from the engine and asserts the baked block matches, so a config
 * retune that isn't re-baked (or a hand-edited literal) fails here. The zoom cap / clamp math is
 * owned by the engine's own suite; matching its output transitively guarantees it.
 *
 * It also pins the SEMANTIC layer: each role's size token binds to a `--type-size-*` step (the
 * app-owned binding the engine has no opinion about), and no raw `--text-*` size step survives.
 */
const SHEET = readFileSync(
  resolve(process.cwd(), "src/styles/foundation.css"),
  "utf8",
);

const normalize = (v: string): string =>
  v.trim().replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");

function parseDeclarations(css: string): Record<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const decls: Record<string, string> = {};
  for (const m of withoutComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    decls[m[1]] = normalize(m[2]);
  }
  return decls;
}

const SHEET_DECLS = parseDeclarations(SHEET);
const ENGINE_DECLS = Object.fromEntries(
  typeScaleToDeclarations(buildTypeScale()).map(([prop, value]) => [
    prop,
    normalize(value),
  ]),
);
const RAMP_TOKENS = Object.keys(ENGINE_DECLS);

describe("foundation.css --type-size ramp IS @garden/type's default scale", () => {
  it("parsed a non-trivial sheet and a full ramp (false-green guard)", () => {
    expect(Object.keys(SHEET_DECLS).length).toBeGreaterThan(20);
    expect(RAMP_TOKENS.length).toBe(9); // DEFAULT_CONFIG.stepCount
    expect(SHEET_DECLS["--type-size-3"]).toBeDefined();
  });

  for (const token of RAMP_TOKENS) {
    it(`${token} equals the live engine output (buildTypeScale())`, () => {
      expect(SHEET_DECLS[token]).toBe(ENGINE_DECLS[token]);
    });
  }

  it("carries no ramp step the engine did not emit (bijection, not a superset)", () => {
    const sheetRamp = Object.keys(SHEET_DECLS).filter((t) =>
      /^--type-size-\d+$/.test(t),
    );
    expect(sheetRamp.sort()).toEqual(RAMP_TOKENS.sort());
  });
});

describe("foundation.css semantic role layer binds to the ramp", () => {
  const ROLES = [
    "display",
    "title",
    "heading",
    "subheading",
    "body",
    "label",
    "meta",
  ] as const;

  it.each(ROLES)("--type-%s-size binds to a --type-size-* step", (role) => {
    expect(SHEET_DECLS[`--type-${role}-size`]).toMatch(
      /^var\(--type-size-\d+\)$/,
    );
  });

  it.each(ROLES)(
    "--type-%s-family/weight/tracking/leading are defined",
    (role) => {
      for (const facet of ["family", "weight", "tracking", "leading"]) {
        expect(SHEET_DECLS[`--type-${role}-${facet}`]).toBeDefined();
      }
    },
  );
});

describe("the Tailwind-named --text-* size scale is gone", () => {
  it.each(["sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"])(
    "--text-%s is no longer declared",
    (step) => {
      expect(SHEET_DECLS[`--text-${step}`]).toBeUndefined();
    },
  );

  it("--type-ratio (the old hand-tuned derivation knob) is gone", () => {
    expect(SHEET_DECLS["--type-ratio"]).toBeUndefined();
  });

  it("keeps --text-muted, which is a COLOR token, not a size step", () => {
    expect(SHEET_DECLS["--text-muted"]).toBeDefined();
  });
});
