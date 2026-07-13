import { describe, expect, it } from "vitest";

import { firstNonEmpty, isNonBlank } from "./mediaLabel";

describe("isNonBlank", () => {
  it("is true for a string with content", () => {
    expect(isNonBlank("hello")).toBe(true);
  });

  it("is false for undefined", () => {
    expect(isNonBlank(undefined)).toBe(false);
  });

  it("is false for an empty string", () => {
    expect(isNonBlank("")).toBe(false);
  });

  it("is false for a whitespace-only string", () => {
    expect(isNonBlank("   ")).toBe(false);
  });
});

describe("firstNonEmpty", () => {
  it("returns the first candidate that has content", () => {
    expect(firstNonEmpty(["alt text", "caption"])).toBe("alt text");
  });

  // The whole point of the guard: undefined, empty, and whitespace-only are all treated as
  // absent, unlike `??` (which keeps `""`).
  it("skips undefined, empty, and whitespace-only candidates", () => {
    expect(firstNonEmpty([undefined, "", "   ", "real"])).toBe("real");
  });

  it("returns undefined when every candidate is blank", () => {
    expect(firstNonEmpty([undefined, "", "  "])).toBeUndefined();
    expect(firstNonEmpty([])).toBeUndefined();
  });

  it("preserves the original (untrimmed) content when a candidate qualifies", () => {
    expect(firstNonEmpty(["  padded  "])).toBe("  padded  ");
  });
});
