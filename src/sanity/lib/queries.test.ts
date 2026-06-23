import { describe, expect, it } from "vitest";

import { WORK_INDEX_QUERY } from "./queries";

/**
 * The /work index query's contract is "refuse to over-fetch" (§6): it must pull
 * the card fields and must NOT pull the essay. Asserting the query string keeps
 * the data-layer guard honest without rendering an async RSC (untestable in
 * jsdom — testing.md). A failure here means the index payload regressed.
 */
describe("WORK_INDEX_QUERY", () => {
  it("filters to published projects", () => {
    expect(WORK_INDEX_QUERY).toContain('_type == "project"');
    expect(WORK_INDEX_QUERY).toContain("defined(slug.current)");
  });

  it("projects exactly the card fields", () => {
    for (const field of ["blurb", "brandColor", "fontKey", "_id", "title"]) {
      expect(WORK_INDEX_QUERY).toContain(field);
    }
    expect(WORK_INDEX_QUERY).toContain('"slug": slug.current');
  });

  it("never pulls the essay (the over-fetch guard)", () => {
    expect(WORK_INDEX_QUERY).not.toContain("essay");
  });
});
