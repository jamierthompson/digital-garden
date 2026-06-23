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

  it("COMPONENT_KEYS and EMBED_KEYS are empty until Phase 3 / a real widget", () => {
    expect(COMPONENT_KEYS).toHaveLength(0);
    expect(EMBED_KEYS).toHaveLength(0);
  });

  it("isFontKey narrows known keys and rejects unknown ones", () => {
    for (const key of FONT_KEYS) expect(isFontKey(key)).toBe(true);
    expect(isFontKey("not-a-font")).toBe(false);
    expect(isFontKey("")).toBe(false);
  });

  it("isComponentKey / isEmbedKey reject everything while the registries are empty", () => {
    expect(isComponentKey("log-explorer")).toBe(false);
    expect(isEmbedKey("hue-slider")).toBe(false);
  });
});
