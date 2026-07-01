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

import { FALLBACK_SLUG, resolveScope, scopedStyleCss } from "./scopeSeed";

// Mirrors the shape the route passes ProjectScope from a Sanity document.
const VALID_SEED = {
  slug: "oklch-engine",
  brandColor: "oklch(0.62 0.21 264)",
  fontKey: "jetbrains-mono",
} as const;

// The defensive-resolution contract: `resolveScope` must degrade every bad input to
// a safe fallback and NEVER throw.
describe("resolveScope — defensive, never throws", () => {
  it("resolves a valid seed to engine tokens + the keyed slug + resolved font", () => {
    const scope = resolveScope(VALID_SEED);
    expect(scope.slug).toBe("oklch-engine");
    // Engine produced a real (non-fallback) palette for a parseable brand color.
    expect(scope.tokenSet.meta.isFallback).toBe(false);
    expect(scope.tokenSet.tokens.accent).toBeDefined();
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
    // A valid token set is always produced, even from a fallback brand color.
    expect(scope.tokenSet.tokens.accent).toBeDefined();
    // Font always resolves to *some* face (shell mono on a miss).
    expect(scope.font.cssVariable).toMatch(/^--font-/);
  });

  it("collapses a bad/garbage brandColor to the engine fallback palette (never throws)", () => {
    for (const brandColor of ["not-a-color", "", "{}", "url(evil)"]) {
      const scope = resolveScope({
        slug: "oklch-engine",
        brandColor,
        fontKey: "inter",
      });
      expect(scope.tokenSet.meta.isFallback).toBe(true);
    }
  });

  it("falls back to the shell mono face on an unknown/non-string fontKey", () => {
    const unknown = resolveScope({
      slug: "oklch-engine",
      brandColor: "#0099ff",
      fontKey: "not-a-font",
    });
    expect(unknown.font.cssVariable).toBe("--font-geist-mono");

    const nonString = resolveScope({
      slug: "oklch-engine",
      brandColor: "#0099ff",
      fontKey: 123,
    });
    expect(nonString.font.cssVariable).toBe("--font-geist-mono");
  });

  it("sanitizes a hostile slug so it can never inject into the emitted CSS selector", () => {
    // The hostile slug is stripped to `[a-z0-9-]` (inert chars), so no bracket/brace/quote
    // survives to break out of the `[data-project="…"]` selector.
    const css = scopedStyleCss(
      resolveScope({
        slug: '"]}body{color:red}',
        brandColor: "#0099ff",
        fontKey: "inter",
      }),
    );
    expect(css).toContain('[data-project="bodycolorred"]');
    expect(css).not.toContain("]}");
    expect(css).not.toContain("body{color:red}");
  });

  it("keeps a distinct sanitized slug per project so scopes can't collide (theme-bleed guard)", () => {
    // Regression guard: two seed projects without a component module both used to collapse to
    // `FALLBACK_SLUG`, sharing one `[data-project]` scope + `<style href="project-theme-…">`.
    // React 19 de-dupes hoisted styles by href and keeps the first, so navigating between them
    // cross-contaminated the theme. Distinct slugs → distinct scopes + hrefs → no bleed.
    const gold = resolveScope({
      slug: "goldenrod",
      brandColor: "#d4a017",
      fontKey: "inter",
    });
    const marg = resolveScope({
      slug: "marginalia",
      brandColor: "#1a1a2e",
      fontKey: "inter",
    });
    expect(gold.slug).toBe("goldenrod");
    expect(marg.slug).toBe("marginalia");
    expect(gold.slug).not.toBe(marg.slug);
    expect(scopedStyleCss(gold)).toContain('[data-project="goldenrod"]');
    expect(scopedStyleCss(marg)).toContain('[data-project="marginalia"]');
  });
});

describe("scopedStyleCss", () => {
  const css = scopedStyleCss(resolveScope(VALID_SEED));

  it("wraps the scoped block in @layer brand", () => {
    expect(css).toMatch(/^@layer brand \{/);
    expect(css).toContain('[data-project="oklch-engine"]');
  });

  it("emits baked semantic-token light-dark() literals + the color-scheme", () => {
    expect(css).toContain("color-scheme: light dark;");
    expect(css).toMatch(
      /--accent: light-dark\(oklch\([^)]+\), oklch\([^)]+\)\);/,
    );
    expect(css).toContain("--focus-ring:");
    // The prefix-drop reaches the slot too — no legacy `--brand-` namespace is emitted.
    expect(css).not.toContain("--brand-");
  });

  it("aliases --focus-ring-color to the semantic focus-ring token", () => {
    expect(css).toContain("--focus-ring-color: var(--focus-ring);");
  });

  it("maps --font-face to the resolved roster face + fallback stack", () => {
    const { cssVariable } = FONT_FACES["jetbrains-mono"];
    expect(css).toContain(
      `--font-face: var(${cssVariable}), ui-monospace, monospace;`,
    );
  });
});
