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
    [
      "an unknown slug",
      { slug: "does-not-exist", ...{ brandColor: "#09f", fontKey: "inter" } },
    ],
    ["a non-string slug", { slug: 123 }],
    ["an empty object", {}],
    ["a hostile CSS-injection slug", { slug: '"]}html{display:none}' }],
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

  it("never interpolates an untrusted slug into the emitted CSS selector", () => {
    // The hostile slug collapses to the constant fallback slug, so the payload cannot
    // reach the `[data-project="…"]` selector.
    const css = scopedStyleCss(
      resolveScope({
        slug: '"]}body{color:red}',
        brandColor: "#0099ff",
        fontKey: "inter",
      }),
    );
    expect(css).toContain(`[data-project="${FALLBACK_SLUG}"]`);
    expect(css).not.toContain("body{color:red}");
  });
});

describe("scopedStyleCss", () => {
  const css = scopedStyleCss(resolveScope(VALID_SEED));

  it("wraps the scoped block in @layer brand", () => {
    expect(css).toMatch(/^@layer brand \{/);
    expect(css).toContain('[data-project="oklch-engine"]');
  });

  it("emits baked --brand-* light-dark() literals + the color-scheme", () => {
    expect(css).toContain("color-scheme: light dark;");
    expect(css).toMatch(
      /--brand-accent: light-dark\(oklch\([^)]+\), oklch\([^)]+\)\);/,
    );
    expect(css).toContain("--brand-focus-ring:");
  });

  it("aliases --focus-ring-color to the engine focus-ring token", () => {
    expect(css).toContain("--focus-ring-color: var(--brand-focus-ring);");
  });

  it("maps --font-face to the resolved roster face + fallback stack", () => {
    const { cssVariable } = FONT_FACES["jetbrains-mono"];
    expect(css).toContain(
      `--font-face: var(${cssVariable}), ui-monospace, monospace;`,
    );
  });
});
