import { describe, expect, it } from "vitest";

import {
  COMPONENT_KEYS,
  FONT_KEYS,
  SLOT_KEYS,
  isComponentKey,
  isFontKey,
  isSlotKey,
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

  it("COMPONENT_KEYS is empty — no entry modules are registered yet", () => {
    // No coded module has landed. The registry stays (with its `satisfies` guard) so the first
    // real module just adds its key here.
    expect(COMPONENT_KEYS).toEqual([]);
    expect(new Set(COMPONENT_KEYS).size).toBe(COMPONENT_KEYS.length);
  });

  it("SLOT_KEYS is empty — no in-essay slots are registered yet", () => {
    // No slots are registered. Registering one means adding its key here; a `slotKey` on a
    // published block that matches nothing renders the serializer's missing-slot placeholder
    // rather than crashing.
    expect(SLOT_KEYS).toEqual([]);
    expect(new Set(SLOT_KEYS).size).toBe(SLOT_KEYS.length);
  });

  it("isFontKey narrows known keys and rejects unknown ones", () => {
    for (const key of FONT_KEYS) expect(isFontKey(key)).toBe(true);
    expect(isFontKey("not-a-font")).toBe(false);
    expect(isFontKey("")).toBe(false);
  });

  it("isComponentKey and isSlotKey reject every key while the registries are empty", () => {
    for (const key of ["first-light", "log-explorer", "any-module", ""]) {
      expect(isComponentKey(key)).toBe(false);
    }
    for (const key of ["sunrise-meter", "hue-slider", "any-slot", ""]) {
      expect(isSlotKey(key)).toBe(false);
    }
  });
});
