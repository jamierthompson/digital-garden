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

import {
  FALLBACK_SLUG,
  hashCss,
  resolveScope,
  scopedStyleCss,
} from "./scopeSeed";

// Mirrors the shape the route passes EntryScope from a Sanity document.
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
    // survives to break out of the `[data-entry="…"]` selector.
    const css = scopedStyleCss(
      resolveScope({
        slug: '"]}body{color:red}',
        brandColor: "#0099ff",
        fontKey: "inter",
      }),
    );
    expect(css).toContain('[data-entry="bodycolorred"]');
    expect(css).not.toContain("]}");
    expect(css).not.toContain("body{color:red}");
  });

  it("keeps a distinct sanitized slug per project so scopes can't collide (theme-bleed guard)", () => {
    // Regression guard: two seed projects without a component module both used to collapse to
    // `FALLBACK_SLUG`, sharing one `[data-entry]` scope + `<style href="entry-theme-…">`.
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
    expect(scopedStyleCss(gold)).toContain('[data-entry="goldenrod"]');
    expect(scopedStyleCss(marg)).toContain('[data-entry="marginalia"]');
  });
});

describe("scopedStyleCss", () => {
  const css = scopedStyleCss(resolveScope(VALID_SEED));

  it("wraps the scoped block in @layer brand", () => {
    expect(css).toMatch(/^@layer brand \{/);
    expect(css).toContain('[data-entry="oklch-engine"]');
  });

  it("emits baked semantic-token light-dark() literals but NOT color-scheme (#159 — inherited on a scoped slot)", () => {
    // A scoped `[data-entry]` slot must inherit `color-scheme` from root, never re-declare it —
    // re-declaring would shadow the site toggle's `:root` override (the flash redline, #159).
    expect(css).not.toContain("color-scheme:");
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

describe("hashCss (content-keyed style href)", () => {
  it("is deterministic and content-sensitive", () => {
    expect(hashCss("theme-a")).toBe(hashCss("theme-a"));
    expect(hashCss("theme-a")).not.toBe(hashCss("theme-b"));
  });

  it("changes when a scope's brand changes, so the hoisted <style> href refreshes", () => {
    const a = scopedStyleCss(
      resolveScope({ slug: "x", brandColor: "#d4a017", fontKey: "inter" }),
    );
    const b = scopedStyleCss(
      resolveScope({ slug: "x", brandColor: "#1a1a2e", fontKey: "inter" }),
    );
    expect(hashCss(a)).not.toBe(hashCss(b));
  });

  it("emits a URL/attribute-safe token (base36)", () => {
    expect(hashCss('anything at all { } [] " ')).toMatch(/^[a-z0-9]+$/);
  });
});

/**
 * Adversarial-QA characterization suite: pins the LIMIT of `vetSlug`'s isolation guarantee.
 *
 * `scopeSeed.ts` claims a per-entry sanitized slug "stays UNIQUE per project". That is only
 * true because uniqueness is enforced UPSTREAM (the Sanity `slug` schema: charset
 * `^[a-z0-9-]+$` + `isUnique`), so on valid published data `vetSlug` is a no-op. `vetSlug`
 * ITSELF is NOT injective — it lowercases and strips non-`[a-z0-9-]` chars, so two distinct
 * inputs can collapse to the SAME `[data-entry]` selector. The content-hashed `<style>` href
 * only prevents IDENTICAL themes from sharing one tag; it does NOT prevent two DIFFERENT themes
 * from both matching one colliding selector.
 *
 * These tests document that reliance so a future change that drops the schema's uniqueness (or
 * feeds `resolveScope` from a non-Sanity/draft source with looser slugs) is caught here rather
 * than shipping as silent cross-project theme bleed.
 */
describe("vetSlug is not injective — isolation rests on upstream uniqueness", () => {
  it("collapses two DISTINCT raw slugs onto the SAME scope selector", () => {
    // Neither of these could pass the schema (space / uppercase), but they model draft/preview
    // or any non-Sanity caller. Both sanitize to "foobar".
    const a = resolveScope({
      slug: "Foo Bar",
      brandColor: "#d4a017",
      fontKey: "inter",
    });
    const b = resolveScope({
      slug: "foobar",
      brandColor: "#1a1a2e",
      fontKey: "inter",
    });
    expect(a.slug).toBe("foobar");
    expect(b.slug).toBe("foobar");
    expect(a.slug).toBe(b.slug); // collision: same selector for two different projects
  });

  it("emits two DIFFERENT theme bodies that both target the one collided [data-entry]", () => {
    // The cross-bleed hazard made concrete: distinct brands → distinct CSS (so distinct hrefs,
    // React keeps BOTH <style>s), yet both select `[data-entry="foobar"]`. Co-mounted, cascade
    // source-order decides which brand wins — i.e. one project would render the other's theme.
    const a = scopedStyleCss(
      resolveScope({
        slug: "Foo.Bar",
        brandColor: "#d4a017",
        fontKey: "inter",
      }),
    );
    const b = scopedStyleCss(
      resolveScope({ slug: "foobar", brandColor: "#1a1a2e", fontKey: "inter" }),
    );
    expect(a).toContain('[data-entry="foobar"]');
    expect(b).toContain('[data-entry="foobar"]');
    // Different brand → different baked color literals → the content hash would NOT dedupe them.
    expect(a).not.toBe(b);
  });

  it("does the same across a case-fold collision (uppercase → lowercase)", () => {
    const upper = resolveScope({
      slug: "OKLCH-Engine",
      brandColor: "#0099ff",
      fontKey: "inter",
    });
    const lower = resolveScope({
      slug: "oklch-engine",
      brandColor: "#0099ff",
      fontKey: "inter",
    });
    expect(upper.slug).toBe("oklch-engine");
    expect(lower.slug).toBe("oklch-engine");
  });
});

/**
 * Green-but-meaningful lock: the engine must re-bind EVERY editorial semantic token a brand
 * slot could otherwise inherit. If the engine ever stops emitting one (say `--warning`), that
 * role silently falls through to the GLOBAL editorial value inside a brand island — an
 * unbranded status color on a branded surface, whose contrast was never solved against it.
 */
describe("a brand slot re-binds every editorial semantic role (no silent inheritance)", () => {
  const EDITORIAL_ROLES = [
    "bg",
    "surface",
    "surface-2",
    "text",
    "text-muted",
    "border",
    "accent",
    "accent-text",
    "on-accent",
    "focus-ring",
    "success",
    "error",
    "warning",
    "info",
  ];

  it("emits a re-binding declaration for each role", () => {
    const css = scopedStyleCss(
      resolveScope({ slug: "x", brandColor: "#3b82f6", fontKey: "inter" }),
    );
    for (const role of EDITORIAL_ROLES) {
      // Word-boundary match so `--surface` does not match inside `--surface-2`.
      expect(css).toMatch(new RegExp(`--${role}:(?!\\w|-)`));
    }
  });
});
