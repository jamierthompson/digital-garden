import { describe, expect, it, vi } from "vitest";

// Under Vitest next/font/google is untransformed, so mock the faces the roster imports
// (loaded transitively via resolveFontKey + FONT_FACES). See roster.test.ts.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import { FONT_FACES } from "@/fonts/roster";

import { FALLBACK_SLUG, resolveScope } from "./scopeSeed";

// Mirrors the shape the route passes EntryScope from a Sanity document: a slug + up to three
// per-role font keys, each an OPTIONAL roster key.
const VALID_SEED = {
  slug: "oklch-engine",
  headingFont: "space-grotesk",
  bodyFont: "newsreader",
  monoFont: "inter",
} as const;

// The defensive-resolution contract: `resolveScope` must degrade every bad input to a safe
// fallback and NEVER throw. The new model resolves EACH of the three roles independently and
// omits any role whose key is absent or unresolvable (so the slot emits no override for it).
describe("resolveScope — three-role, defensive, never throws", () => {
  it("resolves each role independently to its roster face", () => {
    const scope = resolveScope(VALID_SEED);
    expect(scope.slug).toBe("oklch-engine");
    expect(scope.faces.heading).toEqual(FONT_FACES["space-grotesk"]);
    expect(scope.faces.body).toEqual(FONT_FACES.newsreader);
    expect(scope.faces.mono).toEqual(FONT_FACES.inter);
  });

  it("resolves only the roles that are present, omitting the rest", () => {
    const scope = resolveScope({ slug: "oklch-engine", bodyFont: "fraunces" });
    expect(scope.faces.body).toEqual(FONT_FACES.fraunces);
    // No heading / mono key → those roles are omitted → the slot emits no override → inherit.
    expect(scope.faces.heading).toBeUndefined();
    expect(scope.faces.mono).toBeUndefined();
    expect(Object.keys(scope.faces)).toEqual(["body"]);
  });

  it("omits a role whose key is unknown, keeping the resolvable siblings", () => {
    const scope = resolveScope({
      slug: "oklch-engine",
      headingFont: "space-grotesk",
      bodyFont: "not-a-font",
      monoFont: "inter",
    });
    expect(scope.faces.heading).toEqual(FONT_FACES["space-grotesk"]);
    expect(scope.faces.mono).toEqual(FONT_FACES.inter);
    // The unknown body key drops the body role only — never the whole scope.
    expect(scope.faces.body).toBeUndefined();
  });

  it("omits a role whose key is a non-string (hostile) value", () => {
    const scope = resolveScope({
      slug: "oklch-engine",
      headingFont: 123,
      bodyFont: { evil: true },
      monoFont: "inter",
    });
    expect(scope.faces.heading).toBeUndefined();
    expect(scope.faces.body).toBeUndefined();
    expect(scope.faces.mono).toEqual(FONT_FACES.inter);
  });

  it("returns an empty face set when no role key is present", () => {
    const scope = resolveScope({ slug: "oklch-engine" });
    expect(scope.slug).toBe("oklch-engine");
    expect(scope.faces).toEqual({});
  });

  it.each([
    ["missing seed (undefined)", undefined],
    ["null", null],
    ["a number", 42],
    ["a string", "oklch-engine"], // a bare string is not the seed shape
    ["a non-string slug", { slug: 123 }],
    ["an empty object", {}],
    ["a whitespace-only slug", { slug: "   " }], // sanitizes to empty → fallback
    [
      "a getter that throws",
      {
        get slug(): string {
          throw new Error("boom");
        },
      },
    ],
    [
      "a font-key getter that throws",
      {
        slug: "oklch-engine",
        get bodyFont(): string {
          throw new Error("boom");
        },
      },
    ],
  ])("falls back safely on %s", (_label, input) => {
    let scope!: ReturnType<typeof resolveScope>;
    expect(() => {
      scope = resolveScope(input);
    }).not.toThrow();
    // A throwing input degrades to the constant fallback slug with no faces; a merely
    // shapeless-but-non-throwing input also collapses to the fallback slug + empty faces.
    expect(typeof scope.slug).toBe("string");
    expect(scope.faces).toBeDefined();
  });

  it("collapses to the fallback slug + empty faces when a getter throws", () => {
    const scope = resolveScope({
      get slug(): string {
        throw new Error("boom");
      },
    });
    expect(scope.slug).toBe(FALLBACK_SLUG);
    expect(scope.faces).toEqual({});
  });

  it("sanitizes a hostile slug so it can never inject into the [data-entry] selector", () => {
    // The hostile slug is stripped to `[a-z0-9-]` (inert chars), so no bracket/brace/quote
    // survives to break out of the `[data-entry="…"]` selector EntryScope keys on it.
    const scope = resolveScope({
      slug: '"]}body{color:red}',
      bodyFont: "inter",
    });
    expect(scope.slug).toBe("bodycolorred");
  });

  it("keeps a distinct sanitized slug per entry so scopes can't collide", () => {
    expect(resolveScope({ slug: "goldenrod", bodyFont: "inter" }).slug).toBe(
      "goldenrod",
    );
    expect(resolveScope({ slug: "marginalia", bodyFont: "inter" }).slug).toBe(
      "marginalia",
    );
  });
});

/**
 * Adversarial-QA additions (#226): the edges the three-role suite above skips — array seeds
 * (`typeof [] === "object"`, so an array passes the object guard), the exact-match font-key
 * contract, and the COARSENESS of the belt-and-suspenders catch.
 */
describe("resolveScope — QA hardening edges", () => {
  it.each([
    ["an empty array", []],
    ["an array of key-like strings", ["inter", "newsreader"]],
  ])(
    "collapses %s to the fallback scope (arrays pass the object guard)",
    (_label, input) => {
      // An array IS `typeof "object"`, so it survives the seed-shape guard; its `slug` /
      // role properties are undefined → fallback slug, no faces, no throw.
      const scope = resolveScope(input);
      expect(scope.slug).toBe(FALLBACK_SLUG);
      expect(scope.faces).toEqual({});
    },
  );

  it.each(["Inter", "INTER", " inter", "inter ", "inter​"])(
    "does NOT resolve %j — font keys are exact-match, never normalized",
    (key) => {
      // Deliberate asymmetry: the SLUG is lowercased/stripped (it only keys a selector),
      // but a font key is matched EXACTLY against FONT_KEYS — no trim, no case-fold, no
      // stega-char tolerance. A "helpful" normalization added later would silently widen
      // the roster contract; this pins that a near-miss key drops the role instead.
      const scope = resolveScope({ slug: "entry", bodyFont: key });
      expect(scope.faces.body).toBeUndefined();
      expect(scope.faces).toEqual({});
    },
  );

  it("falls back to the constant slug when every slug char is hostile (nothing survives the strip)", () => {
    const scope = resolveScope({ slug: '"]{};:/\\*', bodyFont: "inter" });
    expect(scope.slug).toBe(FALLBACK_SLUG);
    expect(scope.faces.body).toEqual(FONT_FACES.inter);
  });

  it("collapses the WHOLE scope — valid slug and resolvable siblings included — when a font getter throws", () => {
    // Characterizes the catch's coarseness: a throwing role getter aborts resolution
    // mid-build, so even the valid slug and the already-resolvable sibling keys degrade
    // to the constant fallback with NO faces. Cheaper than partial recovery, and safe:
    // the slot renders unthemed rather than not at all.
    const scope = resolveScope({
      slug: "oklch-engine",
      headingFont: "space-grotesk",
      get monoFont(): string {
        throw new Error("boom");
      },
    });
    expect(scope.slug).toBe(FALLBACK_SLUG);
    expect(scope.faces).toEqual({});
  });
});

/**
 * Adversarial-QA characterization suite: pins the LIMIT of `vetSlug`'s isolation guarantee.
 *
 * `scopeSeed.ts` claims a per-entry sanitized slug "stays UNIQUE per entry". That is only true
 * because uniqueness is enforced UPSTREAM (the Sanity `slug` schema: charset `^[a-z0-9-]+$` +
 * `isUnique`), so on valid published data `vetSlug` is a no-op. `vetSlug` ITSELF is NOT injective
 * — it lowercases and strips non-`[a-z0-9-]` chars, so two distinct inputs can collapse to the
 * SAME `[data-entry]` selector. These tests document that reliance so a future change that drops
 * the schema's uniqueness (or feeds `resolveScope` from a non-Sanity/draft source with looser
 * slugs) is caught here rather than shipping as silent cross-entry bleed.
 */
describe("vetSlug is not injective — isolation rests on upstream uniqueness", () => {
  it("collapses two DISTINCT raw slugs onto the SAME scope selector", () => {
    // Neither of these could pass the schema (space / uppercase), but they model draft/preview
    // or any non-Sanity caller. Both sanitize to "foobar".
    expect(resolveScope({ slug: "Foo Bar", bodyFont: "inter" }).slug).toBe(
      "foobar",
    );
    expect(resolveScope({ slug: "foobar", bodyFont: "inter" }).slug).toBe(
      "foobar",
    );
  });

  it("does the same across a case-fold collision (uppercase → lowercase)", () => {
    expect(resolveScope({ slug: "OKLCH-Engine", bodyFont: "inter" }).slug).toBe(
      "oklch-engine",
    );
    expect(resolveScope({ slug: "oklch-engine", bodyFont: "inter" }).slug).toBe(
      "oklch-engine",
    );
  });
});
