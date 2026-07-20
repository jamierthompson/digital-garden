import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

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

function findCssModules(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findCssModules(full));
    else if (entry.name.endsWith(".module.css")) out.push(full);
  }
  return out;
}

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

describe("the role bundles are declared at BOTH scopes (:root + the entry slot)", () => {
  // A custom property substitutes its var() refs at the element that DECLARES it
  // (css-variables-1, "Substituting a var()"), so a :root-only `--type-<role>-family` freezes to the site face and
  // a slot's `--font-*` override never re-enters it. The sheet therefore declares the bundles
  // under a selector list that ALSO matches the slot element — one set of declarations, two
  // scopes. jsdom can't compute cascaded custom properties, so this receipt parses the selector;
  // regressing it to :root-only would silently strand themed slots on the site faces.
  // Assert `:root` and `:where([data-entry])` as COMPLETE members of the comma-separated
  // selector list — not substrings of it. Substring containment can't tell the list from a
  // descendant combinator (`:root :where([data-entry])`, a dropped comma), which matches slots
  // but NOT `:root` itself, stranding the site scope of every `--type-*` bundle while a
  // substring receipt stays green (QA #262). A dropped comma collapses the split to the single
  // member `:root:where([data-entry])`, which is neither — so it fails here.
  it("declares the bundles as a selector LIST containing :root and :where([data-entry])", () => {
    const sheet = read("src/styles/semantic/type.css").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const rule = sheet.match(/([^{}]+)\{[^{}]*--type-body-family/);
    expect(rule).not.toBeNull();
    const members = rule![1].split(",").map((s) => s.replace(/\s+/g, ""));
    expect(members).toContain(":root");
    expect(members).toContain(":where([data-entry])");
  });

  it("every --type-* bundle lives in that ONE rule (no second, :root-only block)", () => {
    const sheet = read("src/styles/semantic/type.css").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const blocksWithTypeTokens = [
      ...sheet.matchAll(/[^{}]+\{[^{}]*--type-[a-z]/g),
    ];
    expect(blocksWithTypeTokens).toHaveLength(1);
  });
});

describe("semantic role layer binds to the ramp", () => {
  const ROLES = [
    "display",
    "title",
    "heading",
    "subheading",
    "lede",
    "body",
    "label",
    "meta",
    "kicker",
    "caption",
    "quote",
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

// The kicker is an editorial ROLE, not a component-token bundle: a page superhead is page
// content, and the "not a role" carve-out is scoped to chrome. Its five bindings are the owner's
// approved design, pinned here so a retune is a deliberate edit rather than drift.
describe("the kicker role — the superhead above a page's h1", () => {
  it.each([
    ["family", "var(--font-ui)"],
    ["size", "var(--type-size-2)"],
    ["weight", "var(--font-weight-normal)"],
    ["tracking", "var(--tracking-wider)"],
    ["leading", "var(--leading-normal)"],
  ])("--type-kicker-%s is %s", (facet, value) => {
    expect(SHEET_DECLS[`--type-kicker-${facet}`]).toBe(value);
  });
});

// QA (font-palette): the slice binds the three chrome/readout roles to the new `--font-ui`
// voice (Instrument Sans). `--font-ui` is NOT one of the entry-themeable leaves (EntryScope
// rebinds only --font-heading/--font-body/--font-mono), so these roles keep the site UI face
// even inside a themed entry — the mono demotion means an entry's authored mono face NO LONGER
// reaches its meta line. Pin the whole group so a drift back to --font-mono (the pre-slice
// binding) or --font-heading (label's pre-slice binding) trips a test, not just a silent revert.
describe("the UI-voice roles bind to --font-ui, never the mono or an editorial face", () => {
  it.each(["meta", "label", "kicker"] as const)(
    "--type-%s-family is var(--font-ui)",
    (role) => {
      expect(SHEET_DECLS[`--type-${role}-family`]).toBe("var(--font-ui)");
    },
  );

  it("no editorial or mono role accidentally reads --font-ui", () => {
    for (const role of [
      "display",
      "title",
      "heading",
      "subheading",
      "lede",
      "body",
      "caption",
      "quote",
    ] as const) {
      expect(SHEET_DECLS[`--type-${role}-family`]).not.toBe("var(--font-ui)");
    }
  });
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

/**
 * The chrome type bundles (`--type-wordmark-*`, `--type-nav-*`) were DEMOTED out of the role
 * sheet to component tokens in their own modules, so the sheet stays exactly the editorial
 * vocabulary the type engine derives. Dropping them from the `ROLES` list above only stops
 * asserting they exist — it does not assert they're gone, and nothing stopped a future author
 * from re-adding a chrome role. These are that guard.
 */
describe("the demoted chrome type bundles are gone from the role sheet", () => {
  const FACETS = ["family", "size", "weight", "tracking", "leading"] as const;

  it.each(FACETS)("--type-wordmark-%s is no longer declared", (facet) => {
    expect(SHEET_DECLS[`--type-wordmark-${facet}`]).toBeUndefined();
  });

  it.each(FACETS)("--type-nav-%s is no longer declared", (facet) => {
    expect(SHEET_DECLS[`--type-nav-${facet}`]).toBeUndefined();
  });

  it("no CSS Module is left reading a retired chrome bundle", () => {
    // The demotion is only complete if no CONSUMER survives: a module still reading
    // `--type-nav-size` resolves to nothing (invalid at computed-value time → the property
    // falls to its initial value) with no error anywhere. The role sheet's own assertions
    // above cannot see this.
    const orphans: string[] = [];
    for (const file of findCssModules(resolve(process.cwd(), "src"))) {
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      if (/var\(\s*--type-(?:wordmark|nav)-/.test(css)) {
        orphans.push(relative(process.cwd(), file));
      }
    }
    expect(orphans).toEqual([]);
  });
});
