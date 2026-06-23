import { describe, expect, it, vi } from "vitest";

// next/font/google is normally transformed by the Next plugin; under Vitest it
// is not, so the real loaders throw ("Inter is not a function"). Mock each used
// face to return just the `.variable` className the roster reads.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import { FONT_KEYS } from "@/lib/keys";

import { FONT_FACES } from "./roster";

describe("font roster", () => {
  it("maps every FontKey to a face (no gaps, no extras)", () => {
    expect(Object.keys(FONT_FACES).sort()).toEqual([...FONT_KEYS].sort());
  });

  it("exposes a variable className and a --font-* CSS variable per face", () => {
    for (const key of FONT_KEYS) {
      const face = FONT_FACES[key];
      expect(face.variable).toBeTruthy();
      expect(face.cssVariable).toMatch(/^--font-/);
    }
  });

  it("binds each face's cssVariable to the matching key", () => {
    expect(FONT_FACES.inter.cssVariable).toBe("--font-inter");
    expect(FONT_FACES["space-grotesk"].cssVariable).toBe(
      "--font-space-grotesk",
    );
    expect(FONT_FACES["jetbrains-mono"].cssVariable).toBe(
      "--font-jetbrains-mono",
    );
  });
});
