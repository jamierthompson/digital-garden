import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildTypeScale, typeScaleToDeclarations } from "@garden/type";

/**
 * Executable receipt for the type scale + role binding. The `--type-size-*` ramp
 * (`foundation/typography.css`) is the COMPLETE output of `@garden/type`'s default scale, baked as
 * `clamp()` literals — re-derived here and asserted to match, so a config retune that isn't
 * re-baked fails. The semantic role layer (`semantic/type.css`) is app-owned: each role's size
 * binds to a `--type-size-*` step, which the engine has no opinion about.
 */
const read = (rel: string): string =>
  readFileSync(resolve(process.cwd(), rel), "utf8");

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

const SHEET_DECLS = {
  ...parseDeclarations(read("src/styles/foundation/typography.css")),
  ...parseDeclarations(read("src/styles/semantic/type.css")),
};
const ENGINE_DECLS = Object.fromEntries(
  typeScaleToDeclarations(buildTypeScale()).map(([prop, value]) => [
    prop,
    normalize(value),
  ]),
);
const RAMP_TOKENS = Object.keys(ENGINE_DECLS);

describe("--type-size ramp IS @garden/type's default scale", () => {
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

describe("semantic role layer binds to the ramp", () => {
  const ROLES = [
    "display",
    "title",
    "heading",
    "subheading",
    "lead",
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

describe("the --type-*-family bindings re-derive inside a themed slot (#226)", () => {
  // A custom property substitutes its var() references at the element that DECLARES it
  // (css-variables-1 §3.4: computed value = specified value with variables substituted —
  // https://www.w3.org/TR/css-variables-1/#defining-variables). So a family binding declared
  // only at :root freezes to the site face THERE, and descendants inherit the resolved
  // string — a slot's [data-entry] --font-* override never reaches a primitive that reads
  // the --type-*-family bundle. The sheet must therefore re-declare every :root family
  // binding under a [data-entry] scope, where substitution re-runs against the slot's
  // overridden role tokens. Verified live: without this block the /color-engine specimen
  // renders every role in the shell faces despite correct inline overrides on the wrapper.
  const sheet = read("src/styles/semantic/type.css").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const rootFamilies = Object.fromEntries(
    Object.entries(SHEET_DECLS).filter(([token]) =>
      /^--type-[a-z]+-family$/.test(token),
    ),
  );
  const slotBlocks = [...sheet.matchAll(/\[data-entry\][^{]*\{([^}]*)\}/g)]
    .map((m) => m[1])
    .join("\n");
  const slotFamilies = parseDeclarations(slotBlocks);

  it("parsed the :root family bindings (false-green guard)", () => {
    expect(Object.keys(rootFamilies).length).toBeGreaterThanOrEqual(8);
  });

  it.each(Object.keys(rootFamilies))(
    "%s is re-declared under [data-entry] with its :root binding",
    (token) => {
      expect(
        slotFamilies[token],
        `${token} must be re-bound at the [data-entry] scope — declared only at :root it freezes to the site face and the slot's --font-* overrides can never reach it`,
      ).toBe(rootFamilies[token]);
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
});
