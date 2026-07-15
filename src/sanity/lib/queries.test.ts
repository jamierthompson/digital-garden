import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import {
  ENTRY_DETAIL_QUERY,
  ENTRY_FEED_QUERY,
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
