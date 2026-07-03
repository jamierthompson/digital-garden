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

  it("COMPONENT_KEYS is empty — no coded project module has landed yet (#109)", () => {
    // The mock modules were retired; the real studies ship as sketches with no module. The
    // array stays a valid (empty) unique set, and the first real module (#70) adds a key.
    expect(COMPONENT_KEYS).toHaveLength(0);
    expect(new Set(COMPONENT_KEYS).size).toBe(COMPONENT_KEYS.length);
  });

  it("EMBED_KEYS registers the one worked embed example (sunrise-meter), uniquely", () => {
    expect(EMBED_KEYS).toContain("sunrise-meter");
    expect(new Set(EMBED_KEYS).size).toBe(EMBED_KEYS.length);
  });

  it("isFontKey narrows known keys and rejects unknown ones", () => {
    for (const key of FONT_KEYS) expect(isFontKey(key)).toBe(true);
    expect(isFontKey("not-a-font")).toBe(false);
    expect(isFontKey("")).toBe(false);
  });

  it("isComponentKey / isEmbedKey accept registered keys and reject unknowns", () => {
    // No component key resolves while the registry is empty; the embed registry still has one.
    expect(isComponentKey("first-light")).toBe(false);
    expect(isEmbedKey("sunrise-meter")).toBe(true);
    expect(isComponentKey("log-explorer")).toBe(false);
    expect(isEmbedKey("hue-slider")).toBe(false);
  });
});
