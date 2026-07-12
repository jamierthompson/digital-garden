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

  it("FONT_KEYS holds exactly the curated roster (#226)", () => {
    // The roster is a content contract: a Sanity document may already carry any of these
    // keys, so dropping one silently unthemes published entries. Removing a face is a
    // deliberate content migration, not a refactor — this pin makes it show up in review.
    expect([...FONT_KEYS].sort()).toEqual([
      "fraunces",
      "inter",
      "jetbrains-mono",
      "newsreader",
      "space-grotesk",
    ]);
  });

  it("COMPONENT_KEYS is a unique set holding the landed entry modules", () => {
    // The first real coded module is the Color Engine (#70); its key is registered here
    // and mapped to a literal dynamic import in the components resolver.
    expect(new Set(COMPONENT_KEYS).size).toBe(COMPONENT_KEYS.length);
    expect(COMPONENT_KEYS).toContain("color-engine");
    for (const key of COMPONENT_KEYS) expect(typeof key).toBe("string");
  });

  it("EMBED_KEYS is a unique set holding the Color Engine's slots (#131)", () => {
    // The first real embeds: the Color Engine's seven slots, interleaved through its entry's
    // prose. Every key is mapped to a literal dynamic import in the embeds resolver.
    expect(new Set(EMBED_KEYS).size).toBe(EMBED_KEYS.length);
    expect(EMBED_KEYS.length).toBeGreaterThan(0);
    for (const key of EMBED_KEYS) {
      expect(typeof key).toBe("string");
      expect(key).toMatch(/^color-engine-/);
    }
  });

  it("isFontKey narrows known keys and rejects unknown ones", () => {
    for (const key of FONT_KEYS) expect(isFontKey(key)).toBe(true);
    expect(isFontKey("not-a-font")).toBe(false);
    expect(isFontKey("")).toBe(false);
  });

  it("isComponentKey narrows the registered key and rejects unknown ones", () => {
    expect(isComponentKey("color-engine")).toBe(true);
    expect(isComponentKey("first-light")).toBe(false);
    expect(isComponentKey("log-explorer")).toBe(false);
    // The embed registry is still empty — every embed key misses.
    expect(isEmbedKey("sunrise-meter")).toBe(false);
    expect(isEmbedKey("hue-slider")).toBe(false);
  });
});
