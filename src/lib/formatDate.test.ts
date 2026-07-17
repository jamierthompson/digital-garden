import { describe, expect, it } from "vitest";

import { formatDate } from "./formatDate";

describe("formatDate", () => {
  it("formats an ISO date to the readable UTC stamp", () => {
    expect(formatDate("2026-07-16")).toBe("July 16, 2026");
  });

  it("returns null for null and empty input", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("")).toBeNull();
  });

  it("drops a malformed value instead of rendering 'Invalid Date'", () => {
    expect(formatDate("not-a-date")).toBeNull();
  });

  it("is timezone-stable: the UTC pin keeps the date from rolling over", () => {
    // Without the T00:00:00Z + timeZone pin, a negative-offset server renders the prior day.
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });
});
