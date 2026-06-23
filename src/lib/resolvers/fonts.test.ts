import { describe, expect, it, vi } from "vitest";

// See roster.test.ts: next/font/google is untransformed under Vitest, so mock
// the faces the roster imports.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import { FONT_KEYS } from "@/lib/keys";

import { resolveFontKey } from "./fonts";
import { isNotFound } from "./notFound";

describe("resolveFontKey", () => {
  it("resolves every roster key to its face", () => {
    for (const key of FONT_KEYS) {
      const result = resolveFontKey(key);
      expect(isNotFound(result)).toBe(false);
      if (isNotFound(result)) continue;
      expect(result.value.variable).toBeTruthy();
      expect(result.value.cssVariable).toMatch(/^--font-/);
    }
  });

  it("returns a typed NotFound for an unknown key (never throws)", () => {
    const result = resolveFontKey("comic-sans");
    expect(isNotFound(result)).toBe(true);
    if (!isNotFound(result)) throw new Error("expected NotFound");
    expect(result.kind).toBe("font");
    expect(result.key).toBe("comic-sans");
  });
});
