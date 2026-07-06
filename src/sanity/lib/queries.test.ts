import { evaluate, parse } from "groq-js";
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
 * QA (#173): the `.toContain` tests above pin the query STRING; these EXECUTE the real
 * ENTRY_DETAIL_QUERY against a synthetic dataset with groq-js (a declared dependency) to pin
 * its actual `coalesce` SEMANTICS. `coalesce(a, b)` returns the first NON-NULL operand — an
 * empty string is non-null — so `themeSeed` short-circuits on `brandColor` whenever it is a
 * string, INCLUDING "". That is the exact hazard the two fail-first cases below expose.
 */
const NOW_SEED = "#105060";

async function resolveThemeSeed(
  entryOverrides: Record<string, unknown>,
  opts: { withSettings?: boolean } = {},
): Promise<unknown> {
  const entry = {
    _type: "entry",
    _id: "e-under-test",
    title: "Under test",
    slug: { current: "under-test" },
    ...entryOverrides,
  };
  const dataset: unknown[] = [entry];
  if (opts.withSettings ?? true) {
    dataset.push({
      _type: "siteSettings",
      _id: "settings",
      pageThemes: {
        home: "#h",
        browse: "#b",
        about: "#a",
        now: NOW_SEED,
        system: "#s",
      },
    });
  }
  const result = await (
    await evaluate(parse(ENTRY_DETAIL_QUERY), {
      dataset,
      params: { slug: "under-test" },
    })
  ).get();
  return (result as { themeSeed?: unknown }).themeSeed;
}

describe("ENTRY_DETAIL_QUERY themeSeed — executed GROQ coalesce semantics (#173 QA)", () => {
  // --- The contract that HOLDS (pins the good path) ---
  it("a now entry with an ABSENT brandColor inherits the /now page seed", async () => {
    expect(await resolveThemeSeed({ kind: "now" })).toBe(NOW_SEED);
  });

  it("a now entry with a null brandColor inherits the /now page seed", async () => {
    expect(await resolveThemeSeed({ kind: "now", brandColor: null })).toBe(
      NOW_SEED,
    );
  });

  it("a themed entry themes from its OWN brandColor, never the /now seed", async () => {
    expect(
      await resolveThemeSeed({ kind: "project", brandColor: "#4f46e5" }),
    ).toBe("#4f46e5");
  });

  it("falls through to null when no siteSettings singleton is published (defensive)", async () => {
    expect(
      await resolveThemeSeed({ kind: "now" }, { withSettings: false }),
    ).toBeNull();
  });

  // --- The contract that BREAKS (fail-first: proves the real defect) ---
  it("a now entry with an EMPTY-STRING brandColor still inherits the /now seed (empty-string coalesce hole)", async () => {
    // coalesce() only falls through on null; "" is non-null, so themeSeed becomes "" — a
    // SILENTLY unthemed page. "" is reachable: brandColor is NOT required for `now`
    // (requiredForThemedKind exempts it) and isBrandColorString("") returns true, so both
    // author-time guards pass it (the API-write path colorValidation.ts calls out as real).
    // queries.ts claims a now entry "falls through to the authored /now page seed" — it does not.
    expect(await resolveThemeSeed({ kind: "now", brandColor: "" })).toBe(
      NOW_SEED,
    );
  });

  it("a now entry that carries its OWN brandColor still wears the /now seed (now theming is 'ignored downstream')", async () => {
    // entry.ts: "now ... carries no brandColor and inherits the /now page seed (resolved in
    // ENTRY_DETAIL_QUERY); any theming fields set on it are ignored downstream." The query does
    // NOT ignore them: coalesce picks up the now entry's own brandColor, so a now update wears a
    // DIFFERENT theme than the /now index — contradicting the stated single-theme contract.
    expect(await resolveThemeSeed({ kind: "now", brandColor: "#f97316" })).toBe(
      NOW_SEED,
    );
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
