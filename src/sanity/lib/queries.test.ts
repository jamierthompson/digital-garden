import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import { buildTokenSet } from "@garden/oklch";

import {
  ENTRY_DETAIL_QUERY,
  ENTRY_FEED_QUERY,
  FEATURED_QUERY,
  INDEX_QUERY,
  NOW_QUERY,
  SITE_SETTINGS_QUERY,
} from "./queries";

/**
 * The entry-feed (RSS) query syndicates every published entry — any `kind`, `now` included —
 * and its contract is "refuse to over-fetch": it must pull only the `<item>` fields the feed
 * renders (id / title / slug / summary) and NOTHING else. Asserting the query string keeps the
 * data-layer guard honest without rendering an async RSC (untestable in jsdom — testing.md).
 */
describe("ENTRY_FEED_QUERY", () => {
  it("filters to every published entry, not just demos", () => {
    expect(ENTRY_FEED_QUERY).toContain('_type == "entry"');
    expect(ENTRY_FEED_QUERY).toContain("defined(slug.current)");
    // A garden feed syndicates every kind — it must NOT narrow to demo-kind entries.
    expect(ENTRY_FEED_QUERY).not.toContain('kind == "demo"');
  });

  it("orders newest first by the authored iterated date, falling back to _createdAt", () => {
    expect(ENTRY_FEED_QUERY).toContain(
      "order(coalesce(iterated, _createdAt) desc)",
    );
  });

  it("projects exactly the item fields — id / title / slug / summary / published", () => {
    for (const field of ["_id", "title", "summary"]) {
      expect(ENTRY_FEED_QUERY).toContain(field);
    }
    expect(ENTRY_FEED_QUERY).toContain('"slug": slug.current');
    // The item's <pubDate> source: the same ordering expression, so pubDate agrees with feed order.
    expect(ENTRY_FEED_QUERY).toContain(
      '"published": coalesce(iterated, _createdAt)',
    );
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
      _id: "old-demo",
      _createdAt: "2026-01-01T00:00:00Z",
      kind: "demo",
      title: "Old demo",
      slug: { current: "old-demo" },
      summary: "Demos still syndicate.",
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
      summary: "Now syndicates too.",
    },
    {
      _type: "entry",
      _id: "iterated-note",
      _createdAt: "2026-01-15T00:00:00Z",
      iterated: "2026-03-01",
      kind: "note",
      title: "Iterated note",
      slug: { current: "iterated-note" },
      summary: null,
    },
    {
      _type: "entry",
      _id: "slugless",
      _createdAt: "2026-04-01T00:00:00Z",
      kind: "essay",
      title: "No slug yet",
      summary: "Must not syndicate.",
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
      expect.arrayContaining(["old-demo", "fresh-now", "iterated-note"]),
    );
    expect(rows).toHaveLength(3);
  });

  it("orders newest-first by iterated, falling back to _createdAt", async () => {
    const rows = await runFeed();
    // iterated-note's authored 2026-03-01 outranks fresh-now's created 2026-02-01,
    // which outranks old-demo's created 2026-01-01.
    expect(rows.map((r) => r._id)).toEqual([
      "iterated-note",
      "fresh-now",
      "old-demo",
    ]);
  });

  it("projects EXACTLY { _id, title, slug, summary, published } per row — the closed over-fetch guard", async () => {
    const rows = await runFeed();
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        "_id",
        "published",
        "slug",
        "summary",
        "title",
      ]);
    }
    // The alias resolves to the flat slug string the route builds URLs from.
    expect(rows.find((r) => r._id === "fresh-now")?.slug).toBe("a-now-update");
  });

  it("sources `published` from the authored `iterated`, falling back to `_createdAt`", async () => {
    const rows = await runFeed();
    // iterated-note has an authored `iterated`, so `published` is that date, not its `_createdAt`.
    expect(rows.find((r) => r._id === "iterated-note")?.published).toBe(
      "2026-03-01",
    );
    // fresh-now has no `iterated`, so `published` falls back to `_createdAt`.
    expect(rows.find((r) => r._id === "fresh-now")?.published).toBe(
      "2026-02-01T00:00:00Z",
    );
  });

  it("feed order IS published order — each row's projected `published` descends (QA #128)", async () => {
    // The <pubDate> source and the order() key are the same coalesce expression; if they
    // ever diverge, items would sort by one date and display another. Prove the executed
    // rows are already sorted by their own projected value.
    const rows = await runFeed();
    const published = rows.map((r) => r.published as string);
    expect(published).toEqual([...published].sort().reverse());
  });
});

/**
 * QA (#312): the feed against a doc that has drifted from the schema — no `summary`, a stray
 * unknown field. The query must degrade cleanly: still syndicate, project `summary: null`
 * (never surface another field's value under the new name), and the closed projection must
 * not leak the stray key.
 */
describe("ENTRY_FEED_QUERY — drifted doc shape (no summary, stray field)", () => {
  const DRIFTED_DATASET = [
    {
      _type: "entry",
      _id: "drifted",
      _createdAt: "2026-01-01T00:00:00Z",
      kind: "demo",
      title: "Drifted entry",
      slug: { current: "drifted" },
      draftNotes: "Stray field, not in the schema.",
    },
  ];

  it("still syndicates a summary-less doc with `summary: null` — and never leaks the stray field", async () => {
    const rows = (await (
      await evaluate(parse(ENTRY_FEED_QUERY), { dataset: DRIFTED_DATASET })
    ).get()) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    const row = rows[0];
    // The item renders with an empty description (route null-guards), not a crash…
    expect(row.summary).toBeNull();
    // …and the stray field neither leaks under its own key nor masquerades as the summary.
    expect(Object.keys(row)).not.toContain("draftNotes");
    expect(Object.values(row)).not.toContain("Stray field, not in the schema.");
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
      "summary",
      "title",
      "related",
      "backlinks",
    ]) {
      expect(ENTRY_DETAIL_QUERY).toContain(field);
    }
    // The theme is projected as a nested object, not flat fields.
    expect(ENTRY_DETAIL_QUERY).toContain(
      "theme { color, colorDark, headingFont, bodyFont, monoFont }",
    );
    // Incoming backlinks resolve via references() against this document's id.
    expect(ENTRY_DETAIL_QUERY).toContain("references(^._id)");
  });

  it("kind-gates themeSeed's inner rung, then defaults: /now for a now entry, own theme.color for the rest, siteSettings.theme.color beneath both (#166/#253)", () => {
    // The page themes from ONE synchronously-available field, resolved in-query (static shell,
    // flash-free). The inner rung is KIND-gated, not presence-gated: `now` ALWAYS resolves to the
    // authored /now page seed (a now can't set its own color — forbiddenForNow — and the query
    // ignores any that slips through), and every themed kind uses its own theme.color. The outer
    // coalesce is the authored site default beneath both. The `.not.toContain` pins that the
    // INNER rung never regresses to a presence-gated `coalesce(theme.color, …)` — which sourced a
    // now entry's own theme.color and left a `theme.color: ""` now entry unthemed (executed
    // semantics below).
    expect(ENTRY_DETAIL_QUERY).toContain(
      '"themeSeed": coalesce(\n      select(kind == "now" =>',
    );
    expect(ENTRY_DETAIL_QUERY).toContain(
      '*[_type == "siteSettings"][0].pageThemes.now',
    );
    expect(ENTRY_DETAIL_QUERY).toContain(
      '*[_type == "siteSettings"][0].theme.color',
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
 * actual `themeSeed` SEMANTICS. Two rungs (#253):
 *
 * The inner rung is KIND-gated — `select(kind == "now" => …pageThemes.now, theme.color)` — so a
 * `now` entry ALWAYS resolves to the /now seed regardless of its own `theme.color`, and every
 * themed kind resolves to its own. These cases lock that in and are regression guards against a
 * presence-gated `coalesce(theme.color, …)` at this rung: coalesce returns the first NON-NULL
 * operand, and "" is non-null, so it (a) leaked a now entry's own `theme.color` and (b) left a
 * `theme.color: ""` now entry unthemed. The two former fail-first cases below (self-override,
 * empty-string) exposed exactly that; the `select()` closes both.
 *
 * The outer rung is the site default (`coalesce(…, siteSettings.theme.color)`): an entry that
 * authors no seed — and a `now` when no `/now` override is authored — wears the authored site
 * default rather than falling to the engine fallback. That coalesce IS presence-gated, so a
 * reachable-via-API `""` at the inner rung stays `""` (PageTheme collapses it to the engine
 * fallback) instead of silently re-routing to a different authored seed — pinned below.
 */
const NOW_SEED = "#105060";
const DEFAULT_SEED = "#d04090";

async function resolveThemeSeed(
  entryOverrides: Record<string, unknown>,
  opts: {
    withSettings?: boolean;
    settings?: Record<string, unknown>;
  } = {},
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
      theme: { color: DEFAULT_SEED },
      pageThemes: {
        home: "#h",
        browse: "#b",
        about: "#a",
        now: NOW_SEED,
        system: "#s",
      },
      ...(opts.settings ?? {}),
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

  it("a themed entry themes from its OWN theme.color, never the /now seed or the default", async () => {
    expect(
      await resolveThemeSeed({ kind: "demo", theme: { color: "#4f46e5" } }),
    ).toBe("#4f46e5");
  });

  it("a doc with an UNRECOGNIZED kind still themes from its own theme.color", async () => {
    // The select() is gated only on `kind == "now"`, so any other value — known or drifted —
    // falls through to `theme.color` and the detail page keeps its theme.
    expect(
      await resolveThemeSeed({ kind: "bookmark", theme: { color: "#123456" } }),
    ).toBe("#123456");
  });

  it("falls through to null when no siteSettings singleton is published (defensive)", async () => {
    expect(
      await resolveThemeSeed({ kind: "now" }, { withSettings: false }),
    ).toBeNull();
  });

  // --- The site default rung (#253) ---
  it("a themed kind with NO theme object wears the site default (never /now, never null)", async () => {
    // Pre-#253 this resolved null and PageTheme fell back to the engine; the authored
    // default now covers it. The select's now-branch stays kind-gated — no /now leak.
    expect(await resolveThemeSeed({ kind: "note" })).toBe(DEFAULT_SEED);
  });

  it("a themed kind with a null theme.color wears the site default", async () => {
    expect(
      await resolveThemeSeed({ kind: "essay", theme: { color: null } }),
    ).toBe(DEFAULT_SEED);
  });

  it("a now entry wears the site default when NO /now override is authored", async () => {
    // pageThemes.now is itself an override now — absent, the /now chain lands on the default.
    expect(
      await resolveThemeSeed({ kind: "now" }, { settings: { pageThemes: {} } }),
    ).toBe(DEFAULT_SEED);
    expect(
      await resolveThemeSeed(
        { kind: "now" },
        { settings: { pageThemes: null } },
      ),
    ).toBe(DEFAULT_SEED);
  });

  it("an unauthored default (settings without theme) degrades to null like before", async () => {
    expect(
      await resolveThemeSeed({ kind: "note" }, { settings: { theme: null } }),
    ).toBeNull();
  });

  it("a themed kind's EMPTY-STRING theme.color stays '' — it collapses to the engine fallback, never re-routes to the default", async () => {
    // Deliberate: the outer coalesce is presence-gated, and "" is non-null. A `""` authored
    // via the API is bad data; PageTheme collapses it to the engine fallback palette. Falling
    // through to the site default here would make bad data silently wear an authored seed.
    expect(await resolveThemeSeed({ kind: "note", theme: { color: "" } })).toBe(
      "",
    );
  });

  // --- The contract that BREAKS (fail-first: proves the real defect) ---
  it("a now entry with an EMPTY-STRING theme.color still inherits the /now seed (empty-string coalesce hole)", async () => {
    // Regression guard for the empty-string hole. A presence-gated `coalesce` at the INNER rung
    // only falls through on null; "" is non-null, so it would leave themeSeed "" — a SILENTLY
    // unthemed page. "" is reachable: theme.color carries no required floor and
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
 * QA (#226): the string-match test above proves the projection TEXT is
 * `theme { color, colorDark, headingFont, bodyFont, monoFont }`, but nothing proves the projection
 * actually round-trips all three faces from a real document — a dropped or renamed sub-field in the
 * projected shape would evade a substring assertion of the whole line. Execute the full detail query
 * against a dataset and inspect the projected `theme` object directly. This also pins the #226
 * inheritance contract at the query layer: an ABSENT face must come back `null` (the app treats
 * null as "inherit the site face"), never undefined or a thrown read.
 */
describe("ENTRY_DETAIL_QUERY theme projection — executed GROQ semantics (#226 QA)", () => {
  async function resolveTheme(
    theme: Record<string, unknown> | undefined,
  ): Promise<Record<string, unknown> | null> {
    const entry = {
      _type: "entry",
      _id: "e-under-test",
      kind: "demo",
      stage: "shipped",
      title: "Under test",
      slug: { current: "under-test" },
      ...(theme ? { theme } : {}),
    };
    const result = await (
      await evaluate(parse(ENTRY_DETAIL_QUERY), {
        dataset: [entry],
        params: { slug: "under-test" },
      })
    ).get();
    return (result as { theme: Record<string, unknown> | null }).theme;
  }

  it("projects all five theme keys when every face is authored", async () => {
    const theme = await resolveTheme({
      color: "#4f46e5",
      colorDark: "#312e81",
      headingFont: "fraunces",
      bodyFont: "newsreader",
      monoFont: "jetbrains-mono",
    });
    expect(theme).toEqual({
      color: "#4f46e5",
      colorDark: "#312e81",
      headingFont: "fraunces",
      bodyFont: "newsreader",
      monoFont: "jetbrains-mono",
    });
  });

  it("resolves an ABSENT face to null, not undefined — the #226 inheritance shape", async () => {
    // An entry that overrides ONLY the body face: heading + mono must come back null so the app
    // falls back to the site heading/mono faces. A projection that dropped the unset keys (making
    // them `undefined`) would break the resolver's explicit null check and silently diverge from
    // the color half, which is already null-shaped.
    const theme = await resolveTheme({
      color: "#4f46e5",
      bodyFont: "newsreader",
    });
    expect(theme).toEqual({
      color: "#4f46e5",
      colorDark: null,
      headingFont: null,
      bodyFont: "newsreader",
      monoFont: null,
    });
  });

  it("projects the whole theme object as null when the entry carries no theme at all", async () => {
    // A theme-less doc (reachable before an editor authors one) must yield theme === null, not a
    // shell of null-valued keys — the detail route reads `entry.theme?.bodyFont`, which relies on
    // the object itself being nullable.
    expect(await resolveTheme(undefined)).toBeNull();
  });

  it("keeps a malformed face value intact — the schema imposes no constraint, so GROQ passes it through", async () => {
    // #226 leaves the faces unvalidated: an empty string or a non-roster key is accepted by the
    // schema and must survive the projection untouched (the app-side resolver owns never-throws
    // fallback, not the query). Proves the projection does not coerce or drop odd values.
    const theme = await resolveTheme({
      color: "#4f46e5",
      headingFont: "",
      bodyFont: "not-a-roster-key",
    });
    expect(theme).toMatchObject({
      headingFont: "",
      bodyFont: "not-a-roster-key",
      monoFont: null,
    });
  });
});

/**
 * The settings query guards the singleton intent at the data layer: `[0]` returns one
 * document (or null), so the shell never assumes an array. Under #166 it also carries the
 * per-page theme seeds for the site-owned pages (which have no backing entry), and under
 * #253 the site default theme those seeds override.
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

  it("projects the site default theme — color + colorDark (#253)", () => {
    expect(SITE_SETTINGS_QUERY).toMatch(
      /theme\s*\{[^}]*\bcolor\b[^}]*\bcolorDark\b/,
    );
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

/**
 * The Index query feeds ONE surface (`/browse`), so its filter is that surface's contract:
 * note, essay, and demo entries — never a dated `now` update, which
 * `/now` owns via NOW_QUERY (#314). Executed with groq-js rather than string-matched, so the
 * exclusion is proven on real data instead of on the presence of a substring.
 */
describe("INDEX_QUERY — the kinds the Index lists (#314)", () => {
  const INDEX_DATASET = [
    {
      _type: "entry",
      _id: "a-note",
      _createdAt: "2026-01-01T00:00:00Z",
      kind: "note",
      title: "A note",
      slug: { current: "a-note" },
      stage: "sketch",
    },
    {
      _type: "entry",
      _id: "an-essay",
      _createdAt: "2026-01-02T00:00:00Z",
      kind: "essay",
      title: "An essay",
      slug: { current: "an-essay" },
      stage: "shipped",
    },
    {
      _type: "entry",
      _id: "a-demo",
      _createdAt: "2026-01-03T00:00:00Z",
      kind: "demo",
      title: "A demo",
      slug: { current: "a-demo" },
      stage: "prototype",
    },
    {
      _type: "entry",
      _id: "a-now",
      _createdAt: "2026-01-04T00:00:00Z",
      kind: "now",
      title: "A now update",
      slug: { current: "a-now" },
    },
    {
      _type: "entry",
      _id: "slugless-note",
      _createdAt: "2026-01-05T00:00:00Z",
      kind: "note",
      title: "No slug yet",
    },
  ];

  async function runIndex(): Promise<Array<Record<string, unknown>>> {
    return (
      await evaluate(parse(INDEX_QUERY), { dataset: INDEX_DATASET })
    ).get();
  }

  it("returns notes, essays, and demos — and drops the now-update", async () => {
    const rows = await runIndex();
    expect(rows.map((r) => r._id).sort()).toEqual([
      "a-demo",
      "a-note",
      "an-essay",
    ]);
  });

  it("never returns a now-update, so /browse cannot list one even by accident", async () => {
    const rows = await runIndex();
    expect(rows.some((r) => r.kind === "now")).toBe(false);
  });

  it("still drops a slugless (unpublished) row alongside the kind filter", async () => {
    // The `now` exclusion is ANDed onto the existing slug guard — adding one must not
    // shadow the other.
    const rows = await runIndex();
    expect(rows.map((r) => r._id)).not.toContain("slugless-note");
  });
});

/**
 * QA (#314): the edges the exclusion filter itself creates — proven executed, because each
 * rests on a GROQ null/ordering rule that a string assertion cannot see.
 */
describe("INDEX_QUERY — filter and linkCount edges (#314 QA)", () => {
  async function run(
    dataset: Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>> {
    return (await evaluate(parse(INDEX_QUERY), { dataset })).get();
  }

  it('returns a KINDLESS doc — GROQ `null != "now"` is true — leaving the page allowlist to drop it', async () => {
    // A doc with no `kind` (drifted data, a raw API write) passes `kind != "now"`, so it
    // reaches `/browse` with `kind: null`. The page's KIND_SECTIONS allowlist is the layer
    // that owns dropping it — a rewrite to a positive filter (`kind in [...]`) would silently
    // move that responsibility into the query, so the split is pinned here.
    const rows = await run([
      {
        _type: "entry",
        _id: "kindless",
        _createdAt: "2026-01-01T00:00:00Z",
        title: "Kindless",
        slug: { current: "kindless" },
      },
    ]);
    expect(rows.map((r) => r._id)).toEqual(["kindless"]);
    expect(rows[0].kind).toBeNull();
  });

  it("orders freshest first WITHIN a kind — authored `iterated` beats `_createdAt`", async () => {
    const rows = await run([
      {
        _type: "entry",
        _id: "older-but-iterated",
        _createdAt: "2026-01-01T00:00:00Z",
        iterated: "2026-06-01",
        kind: "essay",
        slug: { current: "a" },
      },
      {
        _type: "entry",
        _id: "newer-created",
        _createdAt: "2026-03-01T00:00:00Z",
        kind: "essay",
        slug: { current: "b" },
      },
    ]);
    expect(rows.map((r) => r._id)).toEqual([
      "older-but-iterated",
      "newer-created",
    ]);
  });

  it("counts a backlink FROM a now entry — `now` is excluded from the rows, not from the graph", async () => {
    // The reader can still click through: the note's detail page lists the now entry among
    // its backlinks, and the now entry renders at its flat /[slug]. Excluding `now` from the
    // Index rows must not shrink the hint below what is actually reachable.
    const rows = await run([
      {
        _type: "entry",
        _id: "a-note",
        _createdAt: "2026-01-01T00:00:00Z",
        kind: "note",
        slug: { current: "a-note" },
        related: [],
      },
      {
        _type: "entry",
        _id: "a-now",
        _createdAt: "2026-01-02T00:00:00Z",
        kind: "now",
        slug: { current: "a-now" },
        related: [{ _type: "reference", _ref: "a-note", _key: "k1" }],
      },
    ]);
    expect(rows.map((r) => r._id)).toEqual(["a-note"]);
    expect(rows[0].linkCount).toBe(1);
  });

  it("still counts backlinks when the entry has NO `related` array — a missing field must not null-poison the sum", async () => {
    // GROQ evaluates a traversal of an ABSENT field to `null`, and `null + [...]` is
    // `null` — so without the query's `coalesce(..., [])` a backlinked entry that authored
    // no outgoing link reports a null count and silently loses its hint, while its detail
    // page still lists the backlink. The Studio writes no empty array, so this is the common shape.
    const rows = await run([
      {
        _type: "entry",
        _id: "a-note",
        _createdAt: "2026-01-01T00:00:00Z",
        kind: "note",
        slug: { current: "a-note" },
      },
      {
        _type: "entry",
        _id: "an-essay",
        _createdAt: "2026-01-02T00:00:00Z",
        kind: "essay",
        slug: { current: "an-essay" },
        related: [{ _type: "reference", _ref: "a-note", _key: "k1" }],
      },
    ]);
    const note = rows.find((r) => r._id === "a-note");
    expect(note?.linkCount).toBe(1);
  });
});

/**
 * QA (#318): `linkCount` is DISTINCT neighbors, not a sum of the two directions. A sum
 * counts a both-directions edge twice; the union also has to drop a self-reference and a
 * dangling reference (a deleted target dereferences to `null`), or the hint promises
 * neighbors the reader can't find. Executed, same reason as the suites above.
 */
describe("INDEX_QUERY linkCount — distinct neighbors (#318)", () => {
  const ref = (id: string, key: string) => ({
    _type: "reference",
    _ref: id,
    _key: key,
  });

  function entry(
    id: string,
    related?: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    return {
      _type: "entry",
      _id: id,
      _createdAt: "2026-01-01T00:00:00Z",
      kind: "note",
      slug: { current: id },
      ...(related ? { related } : {}),
    };
  }

  async function linkCounts(
    dataset: Array<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    const rows: Array<{ _id: string; linkCount: unknown }> = await (
      await evaluate(parse(INDEX_QUERY), { dataset })
    ).get();
    return Object.fromEntries(rows.map((r) => [r._id, r.linkCount]));
  }

  it("counts a mutually linked pair ONCE on each side — union, not sum", async () => {
    const counts = await linkCounts([
      entry("a", [ref("b", "k1")]),
      entry("b", [ref("a", "k1")]),
    ]);
    expect(counts).toEqual({ a: 1, b: 1 });
  });

  it("drops a self-reference — only the real neighbor counts", async () => {
    const counts = await linkCounts([
      entry("a", [ref("a", "k1"), ref("b", "k2")]),
      entry("b"),
    ]);
    expect(counts.a).toBe(1);
  });

  it("drops a DANGLING reference — a deleted target is not a neighbor", async () => {
    const counts = await linkCounts([entry("a", [ref("ghost", "k1")])]);
    expect(counts.a).toBe(0);
  });

  it("collapses duplicate outgoing references to the same target", async () => {
    const counts = await linkCounts([
      entry("a", [ref("b", "k1"), ref("b", "k2")]),
      entry("b"),
    ]);
    expect(counts.a).toBe(1);
  });

  it("counts every distinct-neighbor rule at once — self, duplicate, dangling, mutual, backlink-only, and a now backlink", async () => {
    // The single-rule cases above can each pass while a combined shape still miscounts
    // (the union, the self filter, and the dangling filter all operate on ONE array) — so
    // one gnarly row exercises them together: neighbors are b (mutual), c (outgoing),
    // d (backlink-only), now1 (now is excluded from ROWS, not from the graph) = 4.
    const now = {
      _type: "entry",
      _id: "now1",
      _createdAt: "2026-01-01T00:00:00Z",
      kind: "now",
      slug: { current: "now1" },
      related: [ref("a", "k")],
    };
    const counts = await linkCounts([
      entry("a", [
        ref("a", "self"),
        ref("b", "k1"),
        ref("b", "k1-dup"),
        ref("ghost", "k2"),
        ref("c", "k3"),
      ]),
      entry("b", [ref("a", "back")]),
      entry("c"),
      entry("d", [ref("a", "k")]),
      now,
    ]);
    expect(counts.a).toBe(4);
  });
});

/**
 * QA (#318, adversarial): the count must NEVER go null again — `null` reads as "no hint"
 * downstream (`(linkCount ?? 0) > 0`), so a drifted doc shape that re-null-poisons the
 * union silently erases a real neighbor hint. Every raw-API-reachable shape of `related`
 * (the schema types it as an array of entry references, but nothing stops a raw write)
 * must degrade to counting only what actually resolves — and the incoming arm must keep
 * counting regardless. Executed, because each case rests on a GROQ null/traversal rule.
 */
describe("INDEX_QUERY linkCount — drifted `related` shapes never re-null the hint (#318 QA)", () => {
  const ref = (id: string, key: string) => ({
    _type: "reference",
    _ref: id,
    _key: key,
  });

  const doc = (
    id: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    _type: "entry",
    _id: id,
    _createdAt: "2026-01-01T00:00:00Z",
    kind: "note",
    slug: { current: id },
    ...extra,
  });

  async function countOf(
    dataset: Array<Record<string, unknown>>,
    id: string,
  ): Promise<unknown> {
    const rows: Array<{ _id: string; linkCount: unknown }> = await (
      await evaluate(parse(INDEX_QUERY), { dataset })
    ).get();
    return rows.find((r) => r._id === id)?.linkCount;
  }

  it("an explicit `related: null` still counts the backlink — 1, not null", async () => {
    const dataset = [
      doc("a", { related: null }),
      doc("b", { related: [ref("a", "k")] }),
    ];
    expect(await countOf(dataset, "a")).toBe(1);
  });

  it("a non-array `related` (raw-write drift) still counts the backlink — 1, not null", async () => {
    const dataset = [
      doc("a", { related: "not-an-array" }),
      doc("b", { related: [ref("a", "k")] }),
    ];
    expect(await countOf(dataset, "a")).toBe(1);
  });

  it("malformed array elements — a null, a ref-less reference, a bare string — count 0, never null", async () => {
    // None of these dereference to a doc, so none is a neighbor; the traversal must
    // swallow them (the `defined(@)` filter), not poison the whole count.
    expect(await countOf([doc("a", { related: [null] })], "a")).toBe(0);
    expect(
      await countOf(
        [doc("a", { related: [{ _type: "reference", _key: "k" }] })],
        "a",
      ),
    ).toBe(0);
    expect(await countOf([doc("a", { related: ["b"] }), doc("b")], "a")).toBe(
      0,
    );
  });

  it("counts a backlink authored in a NON-`related` reference field — references() is whole-doc, matching the detail page's backlinks", async () => {
    // The detail page's `backlinks` uses the same whole-doc `references()`, so a stray
    // reference field on another entry appears in the Related list — the hint must agree.
    const dataset = [doc("a"), doc("b", { inspiration: ref("a", "k") })];
    expect(await countOf(dataset, "a")).toBe(1);
    expect(await countOf(dataset, "b")).toBe(0);
  });

  it("never counts a reference from a NON-entry document — the incoming arm is entry-gated like the detail page's", async () => {
    const dataset = [
      doc("a"),
      { _type: "siteSettings", _id: "settings", related: [ref("a", "k")] },
    ];
    expect(await countOf(dataset, "a")).toBe(0);
  });
});

/**
 * QA (#314): NOW_QUERY is the other half of the acceptance contract — `/now` displays
 * `kind == "now"` and nothing else — and had no coverage at all. Executed, same reason
 * as the Index suite.
 */
describe("NOW_QUERY — the /now stream lists only now-updates (#314 QA)", () => {
  const NOW_DATASET = [
    {
      _type: "entry",
      _id: "older-now-iterated",
      _createdAt: "2026-01-01T00:00:00Z",
      iterated: "2026-06-01",
      kind: "now",
      title: "Older but iterated",
      slug: { current: "n1" },
    },
    {
      _type: "entry",
      _id: "newer-now",
      _createdAt: "2026-03-01T00:00:00Z",
      kind: "now",
      title: "Newer created",
      slug: { current: "n2" },
    },
    {
      _type: "entry",
      _id: "slugless-now",
      _createdAt: "2026-05-01T00:00:00Z",
      kind: "now",
      title: "No slug yet",
    },
    {
      _type: "entry",
      _id: "a-note",
      _createdAt: "2026-04-01T00:00:00Z",
      kind: "note",
      title: "A note",
      slug: { current: "a-note" },
      stage: "sketch",
    },
    {
      _type: "entry",
      _id: "kindless",
      _createdAt: "2026-04-01T00:00:00Z",
      title: "Kindless",
      slug: { current: "kindless" },
    },
  ];

  async function runNow(): Promise<Array<Record<string, unknown>>> {
    return (await evaluate(parse(NOW_QUERY), { dataset: NOW_DATASET })).get();
  }

  it("returns ONLY published now-updates — other kinds and kindless docs never leak in", async () => {
    const rows = await runNow();
    expect(rows.map((r) => r._id).sort()).toEqual([
      "newer-now",
      "older-now-iterated",
    ]);
  });

  it("streams newest first by authored `iterated`, falling back to `_createdAt`", async () => {
    const rows = await runNow();
    expect(rows.map((r) => r._id)).toEqual(["older-now-iterated", "newer-now"]);
  });
});

/**
 * #321: `/now` rows carry the SAME hardened distinct-neighbor `linkCount` the Index
 * projects — a union of both directions (`array::unique`), minus a self-reference
 * (`@ != ^._id`) and a dangling reference (`defined(@)`), with the load-bearing
 * `coalesce(related[]->_id, [])` guard: GROQ evaluates a traversal of an ABSENT field to
 * `null`, and `null + [...]` is `null` (the #317 null-poison), so without it a now-update
 * that authored no `related` array reports a null count and silently loses its hint.
 * Executed with groq-js, because every case rests on a GROQ null/traversal rule.
 */
describe("NOW_QUERY linkCount — distinct neighbors, never null-poisoned (#321)", () => {
  const ref = (id: string, key: string) => ({
    _type: "reference",
    _ref: id,
    _key: key,
  });

  const doc = (
    id: string,
    kind: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    _type: "entry",
    _id: id,
    _createdAt: "2026-01-01T00:00:00Z",
    kind,
    slug: { current: id },
    ...extra,
  });

  async function countOf(
    dataset: Array<Record<string, unknown>>,
    id: string,
  ): Promise<unknown> {
    const rows: Array<{ _id: string; linkCount: unknown }> = await (
      await evaluate(parse(NOW_QUERY), { dataset })
    ).get();
    return rows.find((r) => r._id === id)?.linkCount;
  }

  it("an ABSENT `related` still counts an incoming backlink — 1, not null", async () => {
    // The common Studio shape: no `related` array was ever authored. This is the
    // null-poison pin — drop the coalesce and this count goes null, not 0 or 1.
    const dataset = [
      doc("n1", "now"),
      doc("a", "note", { related: [ref("n1", "k")] }),
    ];
    expect(await countOf(dataset, "n1")).toBe(1);
  });

  it("counts a mutual edge ONCE — union, not sum", async () => {
    const dataset = [
      doc("n1", "now", { related: [ref("a", "k")] }),
      doc("a", "note", { related: [ref("n1", "k")] }),
    ];
    expect(await countOf(dataset, "n1")).toBe(1);
  });

  it("applies every distinct-neighbor rule at once — self, duplicate, dangling, mutual, backlink-only", async () => {
    // Neighbors of n1: a (mutual), b (outgoing), c (backlink-only) = 3. The self-ref,
    // the duplicate, and the dangling ghost must all wash out of the ONE unioned array.
    const dataset = [
      doc("n1", "now", {
        related: [
          ref("n1", "self"),
          ref("a", "k1"),
          ref("a", "k1-dup"),
          ref("ghost", "k2"),
          ref("b", "k3"),
        ],
      }),
      doc("a", "note", { related: [ref("n1", "back")] }),
      doc("b", "note"),
      doc("c", "note", { related: [ref("n1", "k")] }),
    ];
    expect(await countOf(dataset, "n1")).toBe(3);
  });

  it("a now-update with NO edges at all reports 0, not null — the lone-update baseline", async () => {
    // QA (#321): the suite's null-poison pin always had an incoming backlink to save it, so
    // `count()` was never asked about the empty union. This is the shape of the FIRST now-update
    // ever published (no related authored, nobody links it): `coalesce(null, []) + []`. A number
    // is what the TypeGen'd `linkCount: number` promises, and what EntrySummary's
    // `(linkCount ?? 0) > 0` gate assumes it can compare.
    expect(await countOf([doc("n1", "now")], "n1")).toBe(0);
  });

  it("malformed `related` ELEMENTS — null, a bare string, a ref-less reference — count 0, never null", async () => {
    // QA (#321): the drifted-shapes test covers a bad `related` CONTAINER (null / non-array);
    // a bad element inside a well-formed array is the other half. Each dereferences to null,
    // so `defined(@)` must drop it — matching the detail page, where `related[]->` yields the
    // same nulls and RelatedEntries skips them.
    expect(await countOf([doc("n1", "now", { related: [null] })], "n1")).toBe(
      0,
    );
    expect(
      await countOf([doc("n1", "now", { related: ["bare-string"] })], "n1"),
    ).toBe(0);
    expect(
      await countOf(
        [doc("n1", "now", { related: [{ _type: "reference", _key: "k" }] })],
        "n1",
      ),
    ).toBe(0);
  });

  it("counts a backlink authored in a NON-`related` reference field — references() is whole-doc, like the detail page's backlinks", async () => {
    // QA (#321): pinned on INDEX_QUERY but not on this second copy of the expression. A stray
    // reference field on another entry DOES surface in the detail page's Related list, so the
    // hint has to agree or the two surfaces disagree.
    const dataset = [
      doc("n1", "now"),
      doc("a", "note", { inspiration: ref("n1", "k") }),
    ];
    expect(await countOf(dataset, "n1")).toBe(1);
  });

  it("never counts a reference from a NON-entry document — the incoming arm stays entry-gated", async () => {
    // QA (#321): the `_type == "entry"` guard on the backlink arm, pinned on the NOW copy.
    // The detail page's backlinks are entry-gated too; drop it here and the hint over-promises.
    const dataset = [
      doc("n1", "now"),
      { _type: "siteSettings", _id: "settings", related: [ref("n1", "k")] },
    ];
    expect(await countOf(dataset, "n1")).toBe(0);
  });

  it("projects the hint WITHOUT over-fetching — the row's key set gains linkCount and nothing else", async () => {
    // QA (#321): `/now` deliberately omits `body` (each update links to its own page). Pin the
    // exact projected shape so a future edit to this projection can't quietly pull the whole
    // document — the row is a stream summary, not a detail payload.
    const rows: Array<Record<string, unknown>> = await (
      await evaluate(parse(NOW_QUERY), {
        dataset: [
          doc("n1", "now", {
            body: [{ _type: "block", _key: "b" }],
            theme: { color: "oklch(0.7 0.1 200)" },
            componentKey: "some-module",
          }),
        ],
      })
    ).get();
    expect(Object.keys(rows[0]).sort()).toEqual([
      "_id",
      "iterated",
      "linkCount",
      "slug",
      "summary",
      "title",
    ]);
  });

  it("drifted `related` shapes — explicit null, non-array — never re-null the hint", async () => {
    expect(
      await countOf(
        [
          doc("n1", "now", { related: null }),
          doc("a", "note", { related: [ref("n1", "k")] }),
        ],
        "n1",
      ),
    ).toBe(1);
    expect(
      await countOf(
        [
          doc("n1", "now", { related: "not-an-array" }),
          doc("a", "note", { related: [ref("n1", "k")] }),
        ],
        "n1",
      ),
    ).toBe(1);
  });
});

/**
 * QA (#253): the site-default rung against HOSTILE datasets, and the cross-surface agreement it
 * is supposed to buy. Executed with groq-js — every case here rests on a GROQ null/presence rule
 * (`coalesce` falls through on null but NOT on `""`; a traversal of an absent/non-object field is
 * null, not an error), so a string assertion would prove nothing.
 *
 * The seed under test is deliberately a BLUE (`QA_SITE_DEFAULT`), never the engine's pink
 * `FALLBACK_SEED`. The slice retuned the fallback to the same pink the site currently authors, so
 * a pink default would make "wore the authored default" and "collapsed to the engine safety net"
 * indistinguishable — the two mechanisms are separate and must be told apart by value.
 */
const QA_SITE_DEFAULT = "#0ea5e9";

/** Execute any query against a caller-supplied dataset. Returns the raw result. */
async function runQuery(
  query: string,
  dataset: unknown[],
  params: Record<string, unknown> = {},
): Promise<unknown> {
  return (await (
    await evaluate(parse(query), { dataset, params })
  ).get()) as unknown;
}

function qaSettings(overrides: Record<string, unknown> = {}) {
  return {
    _type: "siteSettings",
    _id: "settings",
    theme: { color: QA_SITE_DEFAULT },
    ...overrides,
  };
}

function qaEntry(overrides: Record<string, unknown> = {}) {
  return {
    _type: "entry",
    _id: "e-qa",
    title: "QA entry",
    slug: { current: "qa-entry" },
    ...overrides,
  };
}

describe("themeSeed — hostile datasets degrade, never poison (#253 QA)", () => {
  it("no settings document at all: a seedless entry resolves null, not an error", async () => {
    const result = (await runQuery(
      ENTRY_DETAIL_QUERY,
      [qaEntry({ kind: "note" })],
      {
        slug: "qa-entry",
      },
    )) as { themeSeed: unknown };
    expect(result.themeSeed).toBeNull();
  });

  it("no settings document at all: a NOW entry resolves null, not an error", async () => {
    // Both rungs traverse an empty `*[_type == "siteSettings"][0]`. GROQ yields null for a
    // traversal of null rather than throwing — the whole chain must degrade, not blow up.
    const result = (await runQuery(
      ENTRY_DETAIL_QUERY,
      [qaEntry({ kind: "now" })],
      {
        slug: "qa-entry",
      },
    )) as { themeSeed: unknown };
    expect(result.themeSeed).toBeNull();
  });

  it("a drifted non-object `theme` on settings degrades to null rather than erroring", async () => {
    // A raw API write can put a string where the object belongs. `.color` on a string is null.
    const result = (await runQuery(
      ENTRY_DETAIL_QUERY,
      [qaEntry({ kind: "note" }), qaSettings({ theme: "not-an-object" })],
      { slug: "qa-entry" },
    )) as { themeSeed: unknown };
    expect(result.themeSeed).toBeNull();
  });

  it("a drifted non-object `pageThemes` degrades a NOW entry onto the site default", async () => {
    const result = (await runQuery(
      ENTRY_DETAIL_QUERY,
      [qaEntry({ kind: "now" }), qaSettings({ pageThemes: "not-an-object" })],
      { slug: "qa-entry" },
    )) as { themeSeed: unknown };
    expect(result.themeSeed).toBe(QA_SITE_DEFAULT);
  });

  it("an EMPTY-STRING site default stays '' — the presence-gated coalesce does not skip it", async () => {
    // `.required()` should stop this in the Studio, but the API write path has no schema.
    // Pinned so the rung's presence-gating is understood as reaching the LAST rung too:
    // "" is a value, so it wins, and PageTheme collapses it to the engine fallback.
    const result = (await runQuery(
      ENTRY_DETAIL_QUERY,
      [qaEntry({ kind: "note" }), qaSettings({ theme: { color: "" } })],
      { slug: "qa-entry" },
    )) as { themeSeed: unknown };
    expect(result.themeSeed).toBe("");
  });

  it("a drifted NUMBER seed passes through unchanged — typed string|null, so PageTheme is the only guard", async () => {
    // The generated type claims `string | null`; GROQ does not coerce. This pins that the
    // runtime contract is WIDER than the type, which is why PageTheme takes `unknown`.
    const result = (await runQuery(
      ENTRY_DETAIL_QUERY,
      [qaEntry({ kind: "note", theme: { color: 12345 } }), qaSettings()],
      { slug: "qa-entry" },
    )) as { themeSeed: unknown };
    expect(result.themeSeed).toBe(12345);
  });

  it("multiple siteSettings docs: BOTH rungs read the SAME [0] document", async () => {
    // The chain fires `*[_type == "siteSettings"][0]` twice, independently. If the two
    // subqueries could land on different docs, a now entry could wear doc A's /now override
    // while falling back to doc B's default. Pin that [0] is stable within one evaluation.
    const dataset = [
      qaEntry({ kind: "now" }),
      {
        _type: "siteSettings",
        _id: "first",
        theme: { color: QA_SITE_DEFAULT },
        pageThemes: {},
      },
      {
        _type: "siteSettings",
        _id: "second",
        theme: { color: "#ff0000" },
        pageThemes: { now: "#00ff00" },
      },
    ];
    const result = (await runQuery(ENTRY_DETAIL_QUERY, dataset, {
      slug: "qa-entry",
    })) as {
      themeSeed: unknown;
    };
    // First doc has no /now override → the chain must land on the FIRST doc's default,
    // never the second doc's override or default.
    expect(result.themeSeed).toBe(QA_SITE_DEFAULT);
  });
});

/**
 * QA (#253): the required→optional flip on `entry.theme.color` created a NEW reachable state —
 * a themed entry with no seed of its own — and #253's contract is that such an entry "wears the
 * site default" EVERYWHERE it paints. The featured card is the second surface that paints an
 * entry's seed: `FEATURED_QUERY` must resolve the SAME `themeSeed` chain the detail query does,
 * or a seedless entry wears the authored default on its page and the engine safety net on its
 * card — invisible while the two values coincide, a silent de-sync the moment the site default
 * is retuned. These pins hold the two surfaces equal by execution, not by review.
 */
describe("FEATURED_QUERY — the featured card's seed vs the entry page's seed (#253 QA)", () => {
  const dataset = [
    qaEntry({ kind: "note", featuredRank: 1 }),
    qaSettings({ pageThemes: {} }),
  ];

  it("a seedless featured entry's DETAIL page wears the authored site default", async () => {
    const result = (await runQuery(ENTRY_DETAIL_QUERY, dataset, {
      slug: "qa-entry",
    })) as {
      themeSeed: unknown;
    };
    expect(result.themeSeed).toBe(QA_SITE_DEFAULT);
  });

  it("a seedless featured entry's CARD resolves the same seed its detail page does", async () => {
    const featured = (await runQuery(FEATURED_QUERY, dataset)) as Array<{
      themeSeed: unknown;
    }>;
    const detail = (await runQuery(ENTRY_DETAIL_QUERY, dataset, {
      slug: "qa-entry",
    })) as {
      themeSeed: unknown;
    };
    // The card and the page are the same entry; they must not wear different themes.
    expect(featured[0].themeSeed).toBe(detail.themeSeed);
  });

  it("a seedless featured card does not fall back to the ENGINE palette", async () => {
    // cardSwatches is total: `null` → buildTokenSet(null) → meta.isFallback. That is the
    // safety net firing on a state the authored default is supposed to cover.
    const featured = (await runQuery(FEATURED_QUERY, dataset)) as Array<{
      themeSeed: unknown;
    }>;
    expect(buildTokenSet(featured[0].themeSeed).meta.isFallback).toBe(false);
  });

  it("a featured NOW entry's card does not fall back to the ENGINE palette either", async () => {
    // A `now` may be featured (FEATURED_QUERY takes any kind) and can NEVER author a color
    // (forbiddenForNow) — so its card used to ALWAYS hit the engine fallback. The kind-gated
    // rung resolves it onto the /now seed, matching its own detail page.
    const nowDataset = [
      qaEntry({ kind: "now", featuredRank: 1 }),
      qaSettings({ pageThemes: { now: "#7c3aed" } }),
    ];
    const featured = (await runQuery(FEATURED_QUERY, nowDataset)) as Array<{
      themeSeed: unknown;
    }>;
    expect(buildTokenSet(featured[0].themeSeed).meta.isFallback).toBe(false);
    expect(featured[0].themeSeed).toBe("#7c3aed");
  });
});
