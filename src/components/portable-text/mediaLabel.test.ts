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

  // NBSP and other ECMAScript WhiteSpace are covered by trim(), so an NBSP-only caption counts as
  // blank — no blank figcaption, no blank accessible name.
  it("is false for a no-break-space-only string", () => {
    expect(isNonBlank("\u00A0\u00A0")).toBe(false);
  });

  // Block fields are untrusted external data: a raw Content Lake write can drift a caption/alt to
  // any JSON shape. A non-string must count as blank (absent), never reach `.trim()` and throw —
  // that would crash every article carrying the drifted block.
  it("treats a non-string value as blank instead of throwing", () => {
    for (const bad of [42, 0, true, false, {}, ["alt"], null] as unknown[]) {
      expect(() => isNonBlank(bad), String(bad)).not.toThrow();
      expect(isNonBlank(bad), String(bad)).toBe(false);
    }
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

  // Same totality bar through the finder: a drifted non-string candidate is skipped, and the
  // first real string still wins.
  it("skips non-string candidates instead of throwing", () => {
    const candidates = [42, {}, "real label"] as unknown[];
    expect(() => firstNonEmpty(candidates)).not.toThrow();
    expect(firstNonEmpty(candidates)).toBe("real label");
  });
});
