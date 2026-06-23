import { describe, expect, it } from "vitest";

import { FALLBACK_SLUG, resolveScope, scopedStyleCss } from "./scopeSeed";

// The Phase 0.5 risk this suite retires: the defensive-resolution contract `[D9]` —
// the stub resolver must degrade every bad input to a safe fallback and NEVER throw.
// Phase 1's OKLCH engine inherits this exact contract, so these assertions outlive the stub.
describe("resolveScope — defensive, never throws [D9]", () => {
  it("resolves a known slug to its hardcoded palette", () => {
    const scope = resolveScope({ slug: "oklch-engine" });
    expect(scope.slug).toBe("oklch-engine");
    expect(scope.tokens["--brand-accent"]).toMatch(/^oklch\(/);
    expect(scope.tokens["--font-face"]).toContain("var(--font-geist-mono)");
  });

  it.each([
    ["missing seed (undefined)", undefined],
    ["null", null],
    ["a number", 42],
    ["a string", "oklch-engine"], // a bare string is not the {slug} shape
    ["an unknown slug", { slug: "does-not-exist" }],
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
    expect(scope.tokens["--brand-accent"]).toMatch(/^oklch\(/);
  });

  it("never interpolates an untrusted slug into the emitted CSS selector", () => {
    // The hostile slug collapses to the constant fallback slug, so the payload
    // cannot reach the `[data-project="…"]` selector.
    const css = scopedStyleCss(resolveScope({ slug: '"]}body{color:red}' }));
    expect(css).toContain(`[data-project="${FALLBACK_SLUG}"]`);
    expect(css).not.toContain("body{color:red}");
  });
});

describe("scopedStyleCss", () => {
  it("wraps the scoped block in @layer brand [D12]", () => {
    const css = scopedStyleCss(resolveScope({ slug: "oklch-engine" }));
    expect(css).toMatch(/^@layer brand \{/);
    expect(css).toContain('[data-project="oklch-engine"]');
    expect(css).toContain("--brand-accent:");
  });
});
