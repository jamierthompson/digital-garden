import { describe, expect, it } from "vitest";

import { firstNonEmpty } from "./mediaLabel";

describe("firstNonEmpty", () => {
  it("returns the first candidate that has content", () => {
    expect(firstNonEmpty(["alt text", "caption"], "Figure")).toBe("alt text");
  });

  it("skips undefined candidates", () => {
    expect(firstNonEmpty([undefined, "caption"], "Figure")).toBe("caption");
  });

  // The whole point of the guard: an empty string is treated as absent, unlike `??`.
  it("skips an empty-string candidate", () => {
    expect(firstNonEmpty(["", "caption"], "Figure")).toBe("caption");
  });

  // A whitespace-only string is a blank accessible name too — also treated as absent.
  it("skips a whitespace-only candidate", () => {
    expect(firstNonEmpty(["   ", "caption"], "Figure")).toBe("caption");
  });

  it("falls back when every candidate is absent or empty", () => {
    expect(firstNonEmpty([undefined, "", "  "], "Figure")).toBe("Figure");
    expect(firstNonEmpty([], "Video")).toBe("Video");
  });

  it("preserves the original (untrimmed) content when a candidate qualifies", () => {
    expect(firstNonEmpty(["  padded  "], "Figure")).toBe("  padded  ");
  });
});
