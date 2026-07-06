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

// Mirrors the shape the route passes EntryScope from a Sanity document.
const VALID_SEED = {
  slug: "oklch-engine",
  fontKey: "jetbrains-mono",
} as const;

// The defensive-resolution contract: `resolveScope` must degrade every bad input to
// a safe fallback and NEVER throw.
describe("resolveScope — defensive, never throws", () => {
  it("resolves a valid seed to the keyed slug + resolved font", () => {
    const scope = resolveScope(VALID_SEED);
    expect(scope.slug).toBe("oklch-engine");
    // Resolved the requested roster face.
    expect(scope.font).toEqual(FONT_FACES["jetbrains-mono"]);
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
  ])("falls back safely on %s", (_label, input) => {
    let scope!: ReturnType<typeof resolveScope>;
    expect(() => {
      scope = resolveScope(input);
    }).not.toThrow();
    expect(scope.slug).toBe(FALLBACK_SLUG);
    // Font always resolves to *some* face (shell mono on a miss).
    expect(scope.font.cssVariable).toMatch(/^--font-/);
  });

  it("falls back to the shell mono face on an unknown/non-string fontKey", () => {
    expect(
      resolveScope({ slug: "oklch-engine", fontKey: "not-a-font" }).font
        .cssVariable,
    ).toBe("--font-geist-mono");

    expect(
      resolveScope({ slug: "oklch-engine", fontKey: 123 }).font.cssVariable,
    ).toBe("--font-geist-mono");
  });

  it("sanitizes a hostile slug so it can never inject into the [data-entry] selector", () => {
    // The hostile slug is stripped to `[a-z0-9-]` (inert chars), so no bracket/brace/quote
    // survives to break out of the `[data-entry="…"]` selector EntryScope keys on it.
    const scope = resolveScope({
      slug: '"]}body{color:red}',
      fontKey: "inter",
    });
    expect(scope.slug).toBe("bodycolorred");
  });

  it("keeps a distinct sanitized slug per entry so scopes can't collide", () => {
    expect(resolveScope({ slug: "goldenrod", fontKey: "inter" }).slug).toBe(
      "goldenrod",
    );
    expect(resolveScope({ slug: "marginalia", fontKey: "inter" }).slug).toBe(
      "marginalia",
    );
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
    expect(resolveScope({ slug: "Foo Bar", fontKey: "inter" }).slug).toBe(
      "foobar",
    );
    expect(resolveScope({ slug: "foobar", fontKey: "inter" }).slug).toBe(
      "foobar",
    );
  });

  it("does the same across a case-fold collision (uppercase → lowercase)", () => {
    expect(resolveScope({ slug: "OKLCH-Engine", fontKey: "inter" }).slug).toBe(
      "oklch-engine",
    );
    expect(resolveScope({ slug: "oklch-engine", fontKey: "inter" }).slug).toBe(
      "oklch-engine",
    );
  });
});
