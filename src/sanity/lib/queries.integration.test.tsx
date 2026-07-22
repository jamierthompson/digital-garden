import { render, screen, within } from "@testing-library/react";
import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import RelatedEntries from "@/components/entry/RelatedEntries";

import {
  ENTRY_DETAIL_QUERY,
  FEATURED_QUERY,
  INDEX_QUERY,
  NOW_QUERY,
} from "./queries";

// The backlink graph, tested by EXECUTION — not string assertions.
//
// queries.test.ts pins the query STRING (it contains `references(^._id)`) and
// RelatedEntries.test.tsx pins the component LOGIC (union / dedupe / self-exclude). Neither
// actually RUNS `references()`, so a regression that leaves the string intact but breaks
// resolution (wrong `^` scope, dropped `->`, a Sanity/GROQ behavior change) would sail past
// both. This test closes that gap: it evaluates the REAL `ENTRY_DETAIL_QUERY` against an
// in-memory dataset with `groq-js` (the same GROQ engine `@sanity/client` uses), then feeds
// the result into `RelatedEntries` — proving the whole chain, query → render, resolves the
// incoming-backlink graph the way the live dataset does. The graph is CROSS-KIND: a `now`
// update participates exactly like any other entry.

/** A `related` array member as Sanity stores it — a real reference, not a slug string. */
function ref(id: string, key: string) {
  return { _type: "reference", _ref: id, _key: key };
}

// A small graph centered on `hub`, built to exercise every ragged case at once:
// - `spoke-mutual` — hub links it AND it links hub → appears on BOTH arms (must de-dupe to 1)
// - `spoke-incoming` — links hub only → an incoming backlink hub never declared (the point of
//   `references()`: an edge authored on the OTHER end still shows here)
// - `now-update` (kind "now") — a NOW entry mutually linked with hub: proves the graph is
//   cross-kind, so a `now` update is a first-class backlink on both ends
// - `hub` self-reference — hub links itself, so `references(hub._id)` returns hub → must be
//   excluded from its own list
// - `ghost` — hub links a since-deleted id → `related[]->` dereferences to null → filtered
// - `island` — unconnected → must never appear
const DATASET = [
  {
    _id: "hub-id",
    _type: "entry",
    kind: "demo",
    title: "Hub",
    slug: { _type: "slug", current: "hub" },
    related: [
      ref("spoke-mutual-id", "a"),
      ref("hub-id", "b"), // self-reference
      ref("missing-ghost-id", "c"), // dangling
      ref("now-update-id", "d"),
    ],
  },
  {
    _id: "spoke-mutual-id",
    _type: "entry",
    kind: "note",
    title: "Spoke Mutual",
    slug: { _type: "slug", current: "spoke-mutual" },
    related: [ref("hub-id", "e")], // → hub is its outgoing edge; hub gets it as a backlink too
  },
  {
    _id: "spoke-incoming-id",
    _type: "entry",
    kind: "essay",
    title: "Spoke Incoming",
    slug: { _type: "slug", current: "spoke-incoming" },
    related: [ref("hub-id", "f")], // only-incoming to hub
  },
  {
    _id: "now-update-id",
    _type: "entry",
    kind: "now",
    title: "Now Update",
    slug: { _type: "slug", current: "now-update" },
    related: [ref("hub-id", "g")], // a `now` entry mutually linked with hub
  },
  {
    _id: "island-id",
    _type: "entry",
    kind: "note",
    title: "Island",
    slug: { _type: "slug", current: "island" },
    related: null,
  },
];

async function fetchDetail(slug: string) {
  const tree = parse(ENTRY_DETAIL_QUERY);
  const value = await evaluate(tree, { dataset: DATASET, params: { slug } });
  return value.get();
}

describe("ENTRY_DETAIL_QUERY backlink graph (executed via groq-js)", () => {
  it("resolves incoming backlinks via references() — including a cross-kind `now` entry", async () => {
    const hub = await fetchDetail("hub");
    const backlinks = (hub.backlinks ?? []) as Array<{
      _id: string;
      kind: string;
    } | null>;
    const backlinkIds = backlinks.map((b) => b?._id);
    // spoke-mutual + spoke-incoming + now-update all reference hub's _id, and hub self-refs,
    // so references(^._id) surfaces exactly these four.
    expect(backlinkIds).toEqual(
      expect.arrayContaining([
        "spoke-mutual-id",
        "spoke-incoming-id",
        "now-update-id",
        "hub-id",
      ]),
    );
    expect(backlinkIds).not.toContain("island-id");
    // The `now` update is a first-class backlink, projected with its kind.
    expect(backlinks).toContainEqual(
      expect.objectContaining({ _id: "now-update-id", kind: "now" }),
    );
  });

  it("dereferences outgoing related and yields null for a dangling ref", async () => {
    const hub = await fetchDetail("hub");
    const resolved = hub.related
      .filter(Boolean)
      .map((r: { _id: string }) => r._id);
    expect(resolved).toEqual(
      expect.arrayContaining(["spoke-mutual-id", "hub-id", "now-update-id"]),
    );
    expect(hub.related).toContain(null); // the ghost dereferenced to null, not a crash
  });

  it("renders the deduped, self-excluded, flat-slug list end to end (incl. the now entry)", async () => {
    const hub = await fetchDetail("hub");
    render(
      <RelatedEntries
        currentId={hub._id}
        related={hub.related}
        backlinks={hub.backlinks}
      />,
    );

    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"))
      .sort();
    // The three real neighbors — hub-self excluded, ghost filtered, island absent,
    // spoke-mutual and now-update de-duped across the related + backlink arms. All flat.
    expect(hrefs).toEqual(["/now-update", "/spoke-incoming", "/spoke-mutual"]);
    expect(
      screen.queryByRole("link", { name: /^hub$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /island/i }),
    ).not.toBeInTheDocument();
  });

  it("resolves a `now` entry's OWN incoming backlinks (the graph is symmetric across kinds)", async () => {
    // Fetch the now-update's detail: hub references it, so hub is its backlink — proving the
    // detail query resolves backlinks for a `now`-kind doc, not just a demo.
    const now = await fetchDetail("now-update");
    expect(now.kind).toBe("now");
    const backlinkIds = (now.backlinks ?? []).map(
      (b: { _id: string } | null) => b?._id,
    );
    expect(backlinkIds).toContain("hub-id");

    render(
      <RelatedEntries
        currentId={now._id}
        related={now.related}
        backlinks={now.backlinks}
      />,
    );
    // hub is both now-update's outgoing edge and its backlink → one deduped link to /hub.
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /hub/i })).toHaveAttribute(
      "href",
      "/hub",
    );
  });

  it("renders nothing when a doc has no edges in either direction", async () => {
    const island = await fetchDetail("island");
    const { container } = render(
      <RelatedEntries
        currentId={island._id}
        related={island.related}
        backlinks={island.backlinks}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(island.backlinks).toEqual([]);
  });
});

// The distinct-neighbor law, tested as a CROSS-LAYER oracle.
//
// A listing row's `linkCount` PROMISES the entry page's Related list: "N Related" must equal
// the number of entries the reader finds after clicking through. Three listing queries carry
// their own copy of the distinct-neighbor expression (`array::unique` + `defined` + the self
// filter), and the component de-dupes with a Set — four independent implementations of one
// law. The suites in queries.test.ts and RelatedEntries.test.tsx pin each layer ALONE, so
// drift between them stays green there. These run BOTH real queries against the SAME dataset
// and render the real component with the detail result, which is the only thing that catches it.

/** A minimal published entry, as Sanity stores it. */
const doc = (
  id: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  _type: "entry",
  _id: id,
  _createdAt: "2026-01-01T00:00:00Z",
  kind: "note",
  title: `Entry ${id}`,
  slug: { current: id },
  ...extra,
});

/** The hint side: run a listing query and read one row's `linkCount`. */
async function listedLinkCount(
  query: string,
  dataset: Array<Record<string, unknown>>,
  id: string,
): Promise<unknown> {
  const rows: Array<{ _id: string; linkCount: unknown }> = await (
    await evaluate(parse(query), { dataset })
  ).get();
  return rows.find((r) => r._id === id)?.linkCount;
}

/** The list side: run the detail query and count the rendered Related items. */
async function renderedRelatedCount(
  dataset: Array<Record<string, unknown>>,
  slug: string,
): Promise<number> {
  const detail = (await (
    await evaluate(parse(ENTRY_DETAIL_QUERY), {
      dataset,
      params: { slug },
    })
  ).get()) as {
    _id: string;
    related: Parameters<typeof RelatedEntries>[0]["related"];
    backlinks: Parameters<typeof RelatedEntries>[0]["backlinks"];
  };
  const { container } = render(
    <RelatedEntries
      currentId={detail._id}
      related={detail.related}
      backlinks={detail.backlinks}
    />,
  );
  return within(container).queryAllByRole("listitem").length;
}

describe("INDEX_QUERY linkCount equals the rendered Related list (#318)", () => {
  const indexLinkCount = (
    dataset: Array<Record<string, unknown>>,
    id: string,
  ) => listedLinkCount(INDEX_QUERY, dataset, id);

  it("a ragged graph — self, duplicate, dangling, mutual, backlink-only, now backlink — yields the SAME count on both surfaces", async () => {
    const dataset = [
      doc("a", {
        related: [
          ref("a", "self"),
          ref("b", "k1"),
          ref("b", "k1-dup"),
          ref("ghost", "k2"),
          ref("c", "k3"),
        ],
      }),
      doc("b", { related: [ref("a", "back")] }),
      doc("c"),
      doc("d", { related: [ref("a", "k")] }),
      doc("now1", { kind: "now", related: [ref("a", "k")] }),
    ];
    const hint = await indexLinkCount(dataset, "a");
    const listed = await renderedRelatedCount(dataset, "a");
    expect(listed).toBe(4);
    expect(hint).toBe(listed);
  });

  it("both ends of a mutual edge agree with their own detail pages", async () => {
    const dataset = [
      doc("a", { related: [ref("b", "k")] }),
      doc("b", { related: [ref("a", "k")] }),
    ];
    expect(await indexLinkCount(dataset, "a")).toBe(
      await renderedRelatedCount(dataset, "a"),
    );
    expect(await indexLinkCount(dataset, "b")).toBe(
      await renderedRelatedCount(dataset, "b"),
    );
  });

  it("a SLUGLESS backlinker counts in the hint AND renders in the list (as plain text) — parity holds", async () => {
    // Neither query filters the incoming arm by slug, and RelatedEntries renders a
    // slugless entry as text rather than dropping it — so the hint still matches.
    const dataset = [
      doc("a"),
      {
        _type: "entry",
        _id: "b",
        _createdAt: "2026-01-01T00:00:00Z",
        kind: "note",
        title: "Unrouted",
        related: [ref("a", "k")],
      },
    ];
    const hint = await indexLinkCount(dataset, "a");
    const listed = await renderedRelatedCount(dataset, "a");
    expect(listed).toBe(1);
    expect(hint).toBe(listed);
  });

  it("zero on both surfaces: an entry whose only edges are a dangling ref and a self-ref shows NO hint and NO Related section", async () => {
    const dataset = [doc("a", { related: [ref("ghost", "k"), ref("a", "s")] })];
    const hint = await indexLinkCount(dataset, "a");
    const listed = await renderedRelatedCount(dataset, "a");
    expect(hint).toBe(0);
    expect(listed).toBe(0);
  });
});

describe("FEATURED_QUERY linkCount equals the rendered Related list (#329)", () => {
  const featuredLinkCount = (
    dataset: Array<Record<string, unknown>>,
    id: string,
  ) => listedLinkCount(FEATURED_QUERY, dataset, id);

  it("a ragged graph — self, duplicate, dangling, mutual, backlink-only — yields the SAME count on the card and the detail page", async () => {
    const dataset = [
      doc("f", {
        featuredRank: 1,
        related: [
          ref("f", "self"),
          ref("b", "k1"),
          ref("b", "k1-dup"),
          ref("ghost", "k2"),
          ref("c", "k3"),
        ],
      }),
      doc("b", { related: [ref("f", "back")] }),
      doc("c"),
      doc("d", { related: [ref("f", "k")] }),
    ];
    const hint = await featuredLinkCount(dataset, "f");
    const listed = await renderedRelatedCount(dataset, "f");
    expect(listed).toBe(3);
    expect(hint).toBe(listed);
  });

  it("zero on both surfaces: a featured entry whose only edges are a dangling ref and a self-ref", async () => {
    const dataset = [
      doc("f", {
        featuredRank: 1,
        related: [ref("ghost", "k"), ref("f", "s")],
      }),
    ];
    const hint = await featuredLinkCount(dataset, "f");
    const listed = await renderedRelatedCount(dataset, "f");
    expect(hint).toBe(0);
    expect(listed).toBe(0);
  });

  it("a backlink authored only as a NESTED body reference (a markDef link) counts on the card AND renders in the list", async () => {
    // `references()` scans the whole document, not just `related` — so an entry that links
    // to the featured one from inside its prose is a neighbor on both surfaces.
    const dataset = [
      doc("f", { featuredRank: 1 }),
      doc("w", {
        body: [
          {
            _type: "block",
            _key: "b1",
            children: [{ _type: "span", _key: "s1", text: "see f" }],
            markDefs: [
              { _type: "internalLink", _key: "m1", reference: ref("f", "r1") },
            ],
          },
        ],
      }),
    ];
    const hint = await featuredLinkCount(dataset, "f");
    const listed = await renderedRelatedCount(dataset, "f");
    expect(listed).toBe(1);
    expect(hint).toBe(listed);
  });

  it("a NON-entry document referencing the featured entry counts on NEITHER surface — both arms filter _type", async () => {
    const dataset = [
      doc("f", { featuredRank: 1 }),
      {
        _type: "siteSettings",
        _id: "settings",
        _createdAt: "2026-01-01T00:00:00Z",
        somewhere: ref("f", "k"),
      },
    ];
    const hint = await featuredLinkCount(dataset, "f");
    const listed = await renderedRelatedCount(dataset, "f");
    expect(hint).toBe(0);
    expect(listed).toBe(0);
  });
});

describe("NOW_QUERY linkCount equals the rendered Related list (#321)", () => {
  const nowLinkCount = (dataset: Array<Record<string, unknown>>, id: string) =>
    listedLinkCount(NOW_QUERY, dataset, id);

  it("a ragged graph around a now-update — self, duplicate, dangling, mutual, backlink-only, now-to-now backlink — yields the SAME count on both surfaces", async () => {
    const dataset = [
      doc("n1", {
        kind: "now",
        related: [
          ref("n1", "self"),
          ref("b", "k1"),
          ref("b", "k1-dup"),
          ref("ghost", "k2"),
        ],
      }),
      doc("b", { related: [ref("n1", "back")] }),
      doc("c", { related: [ref("n1", "k")] }),
      doc("n2", { kind: "now", related: [ref("n1", "k")] }),
    ];
    const hint = await nowLinkCount(dataset, "n1");
    const listed = await renderedRelatedCount(dataset, "n1");
    expect(listed).toBe(3);
    expect(hint).toBe(listed);
  });

  it("zero on both surfaces: a now-update whose only edges are a dangling ref and a self-ref shows NO hint and NO Related section", async () => {
    const dataset = [
      doc("n1", { kind: "now", related: [ref("ghost", "k"), ref("n1", "s")] }),
    ];
    const hint = await nowLinkCount(dataset, "n1");
    const listed = await renderedRelatedCount(dataset, "n1");
    expect(hint).toBe(0);
    expect(listed).toBe(0);
  });

  it("holds parity on MALFORMED related elements — null, bare string, ref-less reference — beside a real neighbor", async () => {
    // The ragged graph above covers bad EDGES; these are bad ELEMENTS. Both layers see the
    // same nulls from `related[]->` — the query must drop them via `defined(@)` and the
    // component via its `!entry` guard, or the hint counts a row nobody can see.
    const dataset = [
      doc("n1", {
        kind: "now",
        related: [
          null,
          "bare-string",
          { _type: "reference", _key: "refless" },
          ref("b", "ok"),
        ],
      }),
      doc("b"),
    ];
    const hint = await nowLinkCount(dataset, "n1");
    const listed = await renderedRelatedCount(dataset, "n1");
    expect(listed).toBe(1);
    expect(hint).toBe(listed);
  });

  it("holds parity when a now-update's neighbor has NO slug — the hint counts what renders as plain text", async () => {
    // A slugless neighbor is invisible to /now's own listing (`defined(slug.current)`) but the
    // detail page still RENDERS it, unlinked. The hint promises the Related list, not the
    // reachable subset — so it must count it.
    const dataset = [
      doc("n1", { kind: "now" }),
      { ...doc("b"), slug: undefined, related: [ref("n1", "k")] },
    ];
    const hint = await nowLinkCount(dataset, "n1");
    const listed = await renderedRelatedCount(dataset, "n1");
    expect(listed).toBe(1);
    expect(hint).toBe(listed);
  });
});
