import { describe, expect, it } from "vitest";

import {
  PROJECT_DETAIL_QUERY,
  SITE_SETTINGS_QUERY,
  WORK_INDEX_QUERY,
} from "./queries";

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

/**
 * The detail query (`/work/<slug>`) is the inverse of the index: it DOES pull the essay
 * and the theming seeds, fetches by `$slug` parameter (never interpolation), and `[0]`s to
 * a single doc so the route can `notFound()` on a miss [D17, D19].
 */
describe("PROJECT_DETAIL_QUERY", () => {
  it("filters by the $slug parameter and collapses to one document", () => {
    expect(PROJECT_DETAIL_QUERY).toContain('_type == "project"');
    expect(PROJECT_DETAIL_QUERY).toContain("slug.current == $slug");
    expect(PROJECT_DETAIL_QUERY).toContain("[0]");
  });

  it("pulls the essay and every theming seed the scope + module need", () => {
    for (const field of [
      "essay",
      "brandColor",
      "brandColorDark",
      "fontKey",
      "componentKey",
      "blurb",
      "title",
      "notes",
      "tags",
    ]) {
      expect(PROJECT_DETAIL_QUERY).toContain(field);
    }
  });

  it("uses a query parameter, never string interpolation (injection guard)", () => {
    expect(PROJECT_DETAIL_QUERY).toContain("$slug");
    expect(PROJECT_DETAIL_QUERY).not.toContain("${");
  });
});

/**
 * The settings query guards the singleton intent at the data layer: `[0]` returns one
 * document (or null), so the shell never assumes an array (§6).
 */
describe("SITE_SETTINGS_QUERY", () => {
  it("guards the singleton with a [0] index", () => {
    expect(SITE_SETTINGS_QUERY).toContain('_type == "siteSettings"');
    expect(SITE_SETTINGS_QUERY).toContain("[0]");
  });

  it("pulls the shell brand seed + identity", () => {
    for (const field of [
      "brandColor",
      "brandColorDark",
      "fontKey",
      "title",
      "description",
    ]) {
      expect(SITE_SETTINGS_QUERY).toContain(field);
    }
  });
});
