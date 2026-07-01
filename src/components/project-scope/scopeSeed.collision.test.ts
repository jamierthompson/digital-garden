import { describe, expect, it, vi } from "vitest";

// next/font/google is untransformed under Vitest — mock the roster faces (as in scopeSeed.test.ts).
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import { resolveScope, scopedStyleCss } from "./scopeSeed";

/**
 * Adversarial-QA characterization suite: pins the LIMIT of `vetSlug`'s isolation guarantee.
 *
 * `scopeSeed.ts` claims a per-project sanitized slug "stays UNIQUE per project". That is only
 * true because uniqueness is enforced UPSTREAM (the Sanity `slug` schema: charset
 * `^[a-z0-9-]+$` + `isUnique`), so on valid published data `vetSlug` is a no-op. `vetSlug`
 * ITSELF is NOT injective — it lowercases and strips non-`[a-z0-9-]` chars, so two distinct
 * inputs can collapse to the SAME `[data-project]` selector. The content-hashed `<style>` href
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

  it("emits two DIFFERENT theme bodies that both target the one collided [data-project]", () => {
    // The cross-bleed hazard made concrete: distinct brands → distinct CSS (so distinct hrefs,
    // React keeps BOTH <style>s), yet both select `[data-project="foobar"]`. Co-mounted, cascade
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
    expect(a).toContain('[data-project="foobar"]');
    expect(b).toContain('[data-project="foobar"]');
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
