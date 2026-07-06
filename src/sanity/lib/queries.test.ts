import { describe, expect, it } from "vitest";

import {
  ENTRY_DETAIL_QUERY,
  SITE_SETTINGS_QUERY,
  WORK_INDEX_QUERY,
} from "./queries";

/**
 * The project-feed (RSS) query's contract is "refuse to over-fetch": it must pull
 * the feed fields and must NOT pull the body. Asserting the query string keeps
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

  it("never resolves the backlink graph on a card (the graph is detail-only)", () => {
    // A card must not drag the outgoing `related[]->` deref or the incoming
    // `references()` subquery — that graph resolution is the detail query's job and
    // would blow up the index payload / query cost for every card.
    expect(WORK_INDEX_QUERY).not.toContain("related");
    expect(WORK_INDEX_QUERY).not.toContain("backlinks");
    expect(WORK_INDEX_QUERY).not.toContain("references(");
  });
});

/**
 * The detail query (`/[slug]`) is the inverse of the index: it DOES pull the body
 * and the theming seeds, resolves backlinks both directions (`related[]->` outgoing +
 * incoming `references()`), fetches by `$slug` parameter (never interpolation), and `[0]`s
 * to a single doc so the route can `notFound()` on a miss.
 */
describe("ENTRY_DETAIL_QUERY", () => {
  it("filters by the $slug parameter and collapses to one document", () => {
    expect(ENTRY_DETAIL_QUERY).toContain('_type == "entry"');
    expect(ENTRY_DETAIL_QUERY).toContain("slug.current == $slug");
    expect(ENTRY_DETAIL_QUERY).toContain("[0]");
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
    ]) {
      expect(ENTRY_DETAIL_QUERY).toContain(field);
    }
    // Incoming backlinks resolve via references() against this document's id.
    expect(ENTRY_DETAIL_QUERY).toContain("references(^._id)");
  });

  it("resolves a single themeSeed, coalescing a now entry to the /now page seed (#166)", () => {
    // The page themes from ONE synchronously-available field: the entry's own brandColor,
    // or — when absent (a `now` update) — the authored /now page seed on siteSettings. Resolved
    // in the query so it lands in the awaited result (static shell, flash-free), never behind a
    // second async fetch. A regression to a bare `brandColor` seed would flash the now page.
    expect(ENTRY_DETAIL_QUERY).toContain('"themeSeed": coalesce(brandColor,');
    expect(ENTRY_DETAIL_QUERY).toContain(
      '*[_type == "siteSettings"][0].pageThemes.now',
    );
  });

  it("scopes the incoming backlinks to an aliased entry subquery, not a stray root filter", () => {
    // `backlinks` must be a nested projection aliased on the document — an array of
    // OTHER entries that reference it — not a `references()` predicate applied to the
    // matched doc itself. Assert the alias, the entry-typed subquery, and that both the
    // outgoing edge and the incoming edge carry the `kind` needed for the card label.
    expect(ENTRY_DETAIL_QUERY).toContain('"backlinks": *[_type == "entry"');
    expect(ENTRY_DETAIL_QUERY).toContain("related[]->{");
    // Both graph directions project a resolvable slug (never the raw reference) + kind.
    expect(ENTRY_DETAIL_QUERY).toMatch(
      /related\[\]->\{[^}]*"slug": slug\.current[^}]*kind/,
    );
    expect(ENTRY_DETAIL_QUERY).toMatch(
      /"backlinks":[^}]*"slug": slug\.current[^}]*kind/,
    );
  });

  it("uses a query parameter, never string interpolation (injection guard)", () => {
    expect(ENTRY_DETAIL_QUERY).toContain("$slug");
    expect(ENTRY_DETAIL_QUERY).not.toContain("${");
  });
});

/**
 * The settings query guards the singleton intent at the data layer: `[0]` returns one
 * document (or null), so the shell never assumes an array. Under #166 it also carries the
 * per-page theme seeds for the site-owned pages (which have no backing entry).
 */
describe("SITE_SETTINGS_QUERY", () => {
  it("guards the singleton with a [0] index", () => {
    expect(SITE_SETTINGS_QUERY).toContain('_type == "siteSettings"');
    expect(SITE_SETTINGS_QUERY).toContain("[0]");
  });

  it("pulls the shell identity used by generateMetadata", () => {
    for (const field of ["title", "description"]) {
      expect(SITE_SETTINGS_QUERY).toContain(field);
    }
  });

  it("projects the five per-page theme seeds (#166)", () => {
    expect(SITE_SETTINGS_QUERY).toContain("pageThemes");
    for (const page of ["home", "browse", "about", "now", "system"]) {
      expect(SITE_SETTINGS_QUERY).toMatch(
        new RegExp(`pageThemes\\s*\\{[^}]*\\b${page}\\b`),
      );
    }
  });
});
