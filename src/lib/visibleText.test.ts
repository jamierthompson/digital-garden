import { describe, expect, it } from "vitest";

import { linkableSlug, visibleText } from "./visibleText";

/**
 * The stega alphabet `@vercel/stega` encodes with — U+200B / U+200C / U+200D / U+FEFF. A cleared
 * Studio field can come back as a payload of these alone: truthy, and all but U+FEFF survive
 * `String.prototype.trim`, which is exactly why a bare `||` is not enough.
 */
const ZERO_WIDTH_ONLY = "​​‌‍﻿";

describe("visibleText", () => {
  it("passes visible copy through byte-for-byte", () => {
    expect(visibleText("A real title")).toBe("A real title");
  });

  it("preserves surrounding characters rather than trimming — the trim is the TEST, not a transform", () => {
    // Authored prose keeps its stega payload so Visual Editing's click-to-edit overlay can still
    // resolve it; trimming the returned value would strip that mapping.
    const withPayload = `Real title${ZERO_WIDTH_ONLY}`;
    expect(visibleText(withPayload)).toBe(withPayload);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["a whitespace-only string", "   "],
    ["a tab/newline-only string", "\t\n "],
    ["a zero-width-only stega payload", ZERO_WIDTH_ONLY],
  ])("returns null for %s", (_label, value) => {
    expect(visibleText(value)).toBeNull();
  });

  it("does not treat a non-string as text (never throws on a drifted shape)", () => {
    expect(visibleText(42 as unknown as string)).toBeNull();
    expect(visibleText({} as unknown as string)).toBeNull();
  });
});

describe("linkableSlug", () => {
  it("returns a clean slug unchanged", () => {
    expect(linkableSlug("building-this-garden")).toBe("building-this-garden");
  });

  it("TRIMS rather than preserving — the value becomes a URL, so padding is a defect", () => {
    expect(linkableSlug("  building-this-garden  ")).toBe(
      "building-this-garden",
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["a whitespace-only slug", "   "],
  ])("returns null for %s — never a dead href='/…'", (_label, value) => {
    expect(linkableSlug(value)).toBeNull();
  });

  it("does not treat a non-string as a slug", () => {
    expect(linkableSlug(42 as unknown as string)).toBeNull();
  });
});
