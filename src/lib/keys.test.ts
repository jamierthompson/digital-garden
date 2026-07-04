import { describe, expect, it } from "vitest";

import {
  COMPONENT_KEYS,
  EMBED_KEYS,
  FONT_KEYS,
  isComponentKey,
  isEmbedKey,
  isFontKey,
} from "./keys";

describe("key contracts", () => {
  it("FONT_KEYS is a non-empty set of unique strings", () => {
    expect(FONT_KEYS.length).toBeGreaterThan(0);
    expect(new Set(FONT_KEYS).size).toBe(FONT_KEYS.length);
    for (const key of FONT_KEYS) expect(typeof key).toBe("string");
  });

  it("COMPONENT_KEYS is a unique set holding the landed project modules", () => {
    // The first real coded module is the Palette Studio (#70); its key is registered here
    // and mapped to a literal dynamic import in the components resolver.
    expect(new Set(COMPONENT_KEYS).size).toBe(COMPONENT_KEYS.length);
    expect(COMPONENT_KEYS).toContain("palette-studio");
    for (const key of COMPONENT_KEYS) expect(typeof key).toBe("string");
  });

  it("EMBED_KEYS is a unique set holding the Palette Studio's slots (#131)", () => {
    // The first real embeds: the studio's seven slots, interleaved through its entry's
    // prose. Every key is mapped to a literal dynamic import in the embeds resolver.
    expect(new Set(EMBED_KEYS).size).toBe(EMBED_KEYS.length);
    expect(EMBED_KEYS.length).toBeGreaterThan(0);
    for (const key of EMBED_KEYS) {
      expect(typeof key).toBe("string");
      expect(key).toMatch(/^palette-studio-/);
    }
  });

  it("isFontKey narrows known keys and rejects unknown ones", () => {
    for (const key of FONT_KEYS) expect(isFontKey(key)).toBe(true);
    expect(isFontKey("not-a-font")).toBe(false);
    expect(isFontKey("")).toBe(false);
  });

  it("isComponentKey narrows the registered key and rejects unknown ones", () => {
    expect(isComponentKey("palette-studio")).toBe(true);
    expect(isComponentKey("first-light")).toBe(false);
    expect(isComponentKey("log-explorer")).toBe(false);
    // The embed registry is still empty — every embed key misses.
    expect(isEmbedKey("sunrise-meter")).toBe(false);
    expect(isEmbedKey("hue-slider")).toBe(false);
  });
});
