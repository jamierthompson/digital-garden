import { describe, expect, it } from "vitest";

import {
  PROJECT_DETAIL_QUERY,
  SITE_SETTINGS_QUERY,
  WORK_INDEX_QUERY,
} from "./queries";

/**
 * The /work index query's contract is "refuse to over-fetch": it must pull
 * the card fields and must NOT pull the body. Asserting the query string keeps
 * the data-layer guard honest without rendering an async RSC (untestable in
 * jsdom — testing.md). A failure here means the index payload regressed.
 */
describe("WORK_INDEX_QUERY", () => {
  it("filters to published project-kind entries", () => {
    expect(WORK_INDEX_QUERY).toContain('_type == "entry"');
    expect(WORK_INDEX_QUERY).toContain('kind == "project"');
    expect(WORK_INDEX_QUERY).toContain("defined(slug.current)");
  });

  it("projects exactly the card fields", () => {
    for (const field of [
      "blurb",
      "brandColor",
      "fontKey",
      "kind",
      "stage",
      "featuredRank",
      "_id",
      "title",
    ]) {
      expect(WORK_INDEX_QUERY).toContain(field);
    }
    expect(WORK_INDEX_QUERY).toContain('"slug": slug.current');
  });

  it("never pulls the body (the over-fetch guard)", () => {
    expect(WORK_INDEX_QUERY).not.toContain("body");
  });
});

/**
 * The detail query (`/work/<slug>`) is the inverse of the index: it DOES pull the body
 * and the theming seeds, resolves backlinks both directions (`related[]->` outgoing +
 * incoming `references()`), fetches by `$slug` parameter (never interpolation), and `[0]`s
 * to a single doc so the route can `notFound()` on a miss.
 */
describe("PROJECT_DETAIL_QUERY", () => {
  it("filters by the $slug parameter and collapses to one document", () => {
    expect(PROJECT_DETAIL_QUERY).toContain('_type == "entry"');
    expect(PROJECT_DETAIL_QUERY).toContain("slug.current == $slug");
    expect(PROJECT_DETAIL_QUERY).toContain("[0]");
  });

  it("pulls the body, the theming seeds, and both directions of the backlink graph", () => {
    for (const field of [
      "body",
      "brandColor",
      "brandColorDark",
      "fontKey",
      "componentKey",
      "kind",
      "stage",
      "blurb",
      "title",
      "related",
      "backlinks",
      "tags",
    ]) {
      expect(PROJECT_DETAIL_QUERY).toContain(field);
    }
    // Incoming backlinks resolve via references() against this document's id.
    expect(PROJECT_DETAIL_QUERY).toContain("references(^._id)");
  });

  it("uses a query parameter, never string interpolation (injection guard)", () => {
    expect(PROJECT_DETAIL_QUERY).toContain("$slug");
    expect(PROJECT_DETAIL_QUERY).not.toContain("${");
  });
});

/**
 * The settings query guards the singleton intent at the data layer: `[0]` returns one
 * document (or null), so the shell never assumes an array.
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
