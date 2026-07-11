import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import {
  ENTRY_DETAIL_QUERY,
  ENTRY_FEED_QUERY,
  SITE_SETTINGS_QUERY,
} from "./queries";

/**
 * The entry-feed (RSS) query syndicates every published entry — any `kind`, `now` included —
 * and its contract is "refuse to over-fetch": it must pull only the `<item>` fields the feed
 * renders (id / title / slug / blurb) and NOTHING else. Asserting the query string keeps the
 * data-layer guard honest without rendering an async RSC (untestable in jsdom — testing.md).
 */
describe("ENTRY_FEED_QUERY", () => {
  it("filters to every published entry, not just projects", () => {
    expect(ENTRY_FEED_QUERY).toContain('_type == "entry"');
    expect(ENTRY_FEED_QUERY).toContain("defined(slug.current)");
    // A garden feed syndicates every kind — it must NOT narrow to project-kind entries.
    expect(ENTRY_FEED_QUERY).not.toContain('kind == "project"');
  });

  it("orders newest first by the authored iterated date, falling back to _createdAt", () => {
    expect(ENTRY_FEED_QUERY).toContain(
      "order(coalesce(iterated, _createdAt) desc)",
    );
  });

  it("projects exactly the item fields — id / title / slug / blurb", () => {
    for (const field of ["_id", "title", "blurb"]) {
      expect(ENTRY_FEED_QUERY).toContain(field);
    }
    expect(ENTRY_FEED_QUERY).toContain('"slug": slug.current');
  });

  it("never over-fetches the body or the dropped theming / facet fields", () => {
    for (const field of [
      "body",
      "themeColor",
      "fontKey",
      "theme",
      "stage",
      "featuredRank",
    ]) {
      expect(ENTRY_FEED_QUERY).not.toContain(field);
    }
  });

  it("never resolves the backlink graph on a feed item (the graph is detail-only)", () => {
    // A feed item must not drag the outgoing `related[]->` deref or the incoming
    // `references()` subquery — that graph resolution is the detail query's job and
    // would blow up the feed payload / query cost for every item.
    expect(ENTRY_FEED_QUERY).not.toContain("related");
    expect(ENTRY_FEED_QUERY).not.toContain("backlinks");
    expect(ENTRY_FEED_QUERY).not.toContain("references(");
  });

  it("does not touch `kind` at all — neither as a filter nor a projected field", () => {
    // The rescope's whole point: the feed no longer discriminates by kind, and RSS never
    // renders it, so the token must not appear anywhere in the query.
    expect(ENTRY_FEED_QUERY).not.toContain("kind");
  });
});

/**
 * QA (#249): the string assertions above can't prove the projection is CLOSED — a field
 * appended to the query would still pass every `.toContain`. Execute the real query with
 * groq-js and assert the rescope semantics: every kind (now included) syndicates, slugless
 * docs are filtered, ordering is iterated-first, and each row carries EXACTLY the four
 * item fields — the executable over-fetch guard.
 */
describe("ENTRY_FEED_QUERY — executed GROQ semantics (QA #249)", () => {
  const FEED_DATASET = [
    {
      _type: "entry",
      _id: "old-project",
      _createdAt: "2026-01-01T00:00:00Z",
      kind: "project",
      title: "Old project",
      slug: { current: "old-project" },
      blurb: "Projects still syndicate.",
      stage: "shipped",
      featuredRank: 1,
      theme: { color: "#4f46e5", bodyFont: "inter" },
      body: [{ _type: "block", children: [] }],
    },
    {
      _type: "entry",
      _id: "fresh-now",
      _createdAt: "2026-02-01T00:00:00Z",
      kind: "now",
      title: "A now update",
      slug: { current: "a-now-update" },
      blurb: "Now syndicates too.",
    },
    {
      _type: "entry",
      _id: "iterated-note",
      _createdAt: "2026-01-15T00:00:00Z",
      iterated: "2026-03-01",
      kind: "note",
      title: "Iterated note",
      slug: { current: "iterated-note" },
      blurb: null,
    },
    {
      _type: "entry",
      _id: "slugless",
      _createdAt: "2026-04-01T00:00:00Z",
      kind: "essay",
      title: "No slug yet",
      blurb: "Must not syndicate.",
    },
    { _type: "siteSettings", _id: "settings", title: "Not an entry" },
  ];

  async function runFeed(): Promise<Array<Record<string, unknown>>> {
    return (
      await evaluate(parse(ENTRY_FEED_QUERY), { dataset: FEED_DATASET })
    ).get();
  }

  it("returns every published kind — now included — and drops the slugless doc", async () => {
    const rows = await runFeed();
    expect(rows.map((r) => r._id)).toEqual(
      expect.arrayContaining(["old-project", "fresh-now", "iterated-note"]),
    );
    expect(rows).toHaveLength(3);
  });

  it("orders newest-first by iterated, falling back to _createdAt", async () => {
    const rows = await runFeed();
    // iterated-note's authored 2026-03-01 outranks fresh-now's created 2026-02-01,
    // which outranks old-project's created 2026-01-01.
    expect(rows.map((r) => r._id)).toEqual([
      "iterated-note",
      "fresh-now",
      "old-project",
    ]);
  });

  it("projects EXACTLY { _id, title, slug, blurb } per row — the closed over-fetch guard", async () => {
    const rows = await runFeed();
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        "_id",
        "blurb",
        "slug",
        "title",
      ]);
    }
    // The alias resolves to the flat slug string the route builds URLs from.
    expect(rows.find((r) => r._id === "fresh-now")?.slug).toBe("a-now-update");
  });
});

/**
 * The detail query (`/[slug]`) is the inverse of the index: it DOES pull the body
 * and the entry's `theme` object, resolves backlinks both directions (`related[]->` outgoing +
 * incoming `references()`), fetches by `$slug` parameter (never interpolation), and `[0]`s
 * to a single doc so the route can `notFound()` on a miss.
 */
describe("ENTRY_DETAIL_QUERY", () => {
  it("filters by the $slug parameter and collapses to one document", () => {
    expect(ENTRY_DETAIL_QUERY).toContain('_type == "entry"');
    expect(ENTRY_DETAIL_QUERY).toContain("slug.current == $slug");
    expect(ENTRY_DETAIL_QUERY).toContain("[0]");
  });

  it("pulls the body, the theme object, componentKey, and both directions of the backlink graph", () => {
    for (const field of [
      "body",
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
    // The theme is projected as a nested object, not flat fields.
    expect(ENTRY_DETAIL_QUERY).toContain(
      "theme { color, colorDark, bodyFont }",
    );
    // Incoming backlinks resolve via references() against this document's id.
    expect(ENTRY_DETAIL_QUERY).toContain("references(^._id)");
  });

  it("kind-gates themeSeed: a now entry always wears /now, others their own theme.color (#166)", () => {
    // The page themes from ONE synchronously-available field, resolved in-query (static shell,
    // flash-free). It is KIND-gated, not presence-gated: `now` ALWAYS resolves to the authored
    // /now page seed (a now can't set its own color — forbiddenForNow — and the query ignores any
    // that slips through), and every themed kind uses its own required theme.color. The
    // `.not.toContain` pins that we never regress to the presence-gated `coalesce(theme.color, …)` —
    // which sourced a now entry's own theme.color and left a `theme.color: ""` now entry unthemed
    // (executed semantics below).
    expect(ENTRY_DETAIL_QUERY).toContain(
      '"themeSeed": select(kind == "now" =>',
    );
    expect(ENTRY_DETAIL_QUERY).toContain(
      '*[_type == "siteSettings"][0].pageThemes.now',
    );
    expect(ENTRY_DETAIL_QUERY).not.toContain("coalesce(theme.color");
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
 * ENTRY_DETAIL_QUERY against a synthetic dataset with groq-js (a declared dependency) to pin its
 * actual `themeSeed` SEMANTICS. themeSeed is KIND-gated — `select(kind == "now" =>
 * …pageThemes.now, theme.color)` — so a `now` entry ALWAYS resolves to the /now seed regardless of
 * its own `theme.color`, and every themed kind resolves to its own. These cases lock that in and
 * are regression guards against the earlier presence-gated `coalesce(theme.color, …)`: coalesce
 * returns the first NON-NULL operand, and "" is non-null, so it (a) leaked a now entry's own
 * `theme.color` and (b) left a `theme.color: ""` now entry unthemed. The two former fail-first cases
 * below (self-override, empty-string) exposed exactly that; the `select()` closes both.
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

describe("ENTRY_DETAIL_QUERY themeSeed — executed GROQ semantics (#173 QA)", () => {
  // --- The contract that HOLDS (pins the good path) ---
  it("a now entry with an ABSENT theme inherits the /now page seed", async () => {
    expect(await resolveThemeSeed({ kind: "now" })).toBe(NOW_SEED);
  });

  it("a now entry with a null theme.color inherits the /now page seed", async () => {
    expect(
      await resolveThemeSeed({ kind: "now", theme: { color: null } }),
    ).toBe(NOW_SEED);
  });

  it("a themed entry themes from its OWN theme.color, never the /now seed", async () => {
    expect(
      await resolveThemeSeed({ kind: "project", theme: { color: "#4f46e5" } }),
    ).toBe("#4f46e5");
  });

  it("falls through to null when no siteSettings singleton is published (defensive)", async () => {
    expect(
      await resolveThemeSeed({ kind: "now" }, { withSettings: false }),
    ).toBeNull();
  });

  it("resolves null for a themed kind with NO theme object at all (PageTheme falls back, never /now)", async () => {
    // QA (#249): the nested read `theme.color` on a theme-less doc must resolve to null —
    // NOT error, and NOT leak the /now seed (the select's now-branch is kind-gated).
    expect(await resolveThemeSeed({ kind: "note" })).toBeNull();
  });

  // --- The contract that BREAKS (fail-first: proves the real defect) ---
  it("a now entry with an EMPTY-STRING theme.color still inherits the /now seed (empty-string coalesce hole)", async () => {
    // Regression guard for the empty-string hole. A presence-gated `coalesce` only falls through
    // on null; "" is non-null, so it would leave themeSeed "" — a SILENTLY unthemed page. "" is
    // reachable: theme.color is NOT required for `now` (requiredForThemedKind exempts it) and
    // isThemeColorString("") returns true, so both author-time guards pass it (the API-write path
    // colorValidation.ts calls out as real). The kind-gated `select()` ignores a now entry's
    // theme.color entirely, so "" can never defeat the /now inheritance.
    expect(await resolveThemeSeed({ kind: "now", theme: { color: "" } })).toBe(
      NOW_SEED,
    );
  });

  it("a now entry that carries its OWN theme.color still wears the /now seed (defense-in-depth behind forbiddenForNow)", async () => {
    // Regression guard for the self-override defect. The `forbiddenForNow` validator now stops a
    // `now` from setting a theme.color at all, but a value can still arrive via a legacy doc or a
    // raw API write that bypasses Studio validation — so the query is the second line of defense.
    // A presence-gated `coalesce` would source that stray theme.color, wearing a DIFFERENT theme
    // than the /now index; the kind-gated `select()` ignores it and always resolves to the /now seed.
    expect(
      await resolveThemeSeed({ kind: "now", theme: { color: "#f97316" } }),
    ).toBe(NOW_SEED);
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
