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

  it("registers the Phase 3 first-slice keys (first-light / sunrise-meter)", () => {
    // Phase 3 lands the dead-simple first project [D17], so the registries are no
    // longer empty. Each holds exactly its one slice key, unique within the array.
    expect(COMPONENT_KEYS).toContain("first-light");
    expect(EMBED_KEYS).toContain("sunrise-meter");
    expect(new Set(COMPONENT_KEYS).size).toBe(COMPONENT_KEYS.length);
    expect(new Set(EMBED_KEYS).size).toBe(EMBED_KEYS.length);
  });

  it("isFontKey narrows known keys and rejects unknown ones", () => {
    for (const key of FONT_KEYS) expect(isFontKey(key)).toBe(true);
    expect(isFontKey("not-a-font")).toBe(false);
    expect(isFontKey("")).toBe(false);
  });

  it("isComponentKey / isEmbedKey accept registered keys and reject unknowns", () => {
    expect(isComponentKey("first-light")).toBe(true);
    expect(isEmbedKey("sunrise-meter")).toBe(true);
    expect(isComponentKey("log-explorer")).toBe(false);
    expect(isEmbedKey("hue-slider")).toBe(false);
  });
});
