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

  describe("adversarial QA — calendar edges on the API path", () => {
    it("formats a real leap day", () => {
      expect(formatDate("2024-02-29")).toBe("February 29, 2024");
    });

    it("drops an out-of-range month or day segment", () => {
      expect(formatDate("2026-13-01")).toBeNull();
      expect(formatDate("2026-00-10")).toBeNull();
    });

    // A syntactically-plausible NON-DATE like Feb 29 of a non-leap year (or Apr 31) rolls
    // over inside `new Date()` — the round-trip check drops it to null instead of rendering
    // a silently wrong date (QA D2).
    it("drops a calendar-impossible date instead of rolling it into the next month", () => {
      expect(formatDate("2023-02-29")).toBeNull();
      expect(formatDate("2026-04-31")).toBeNull();
    });

    it("drops a value that already carries a time (the contract is date-only YYYY-MM-DD)", () => {
      // The template suffix would produce "…T12:00:00ZT00:00:00Z" — Invalid Date → null,
      // never a half-parsed stamp.
      expect(formatDate("2026-07-16T12:00:00Z")).toBeNull();
    });

    it("drops non-zero-padded segments (Sanity's date field always pads)", () => {
      expect(formatDate("2026-7-4")).toBeNull();
    });
  });
});
