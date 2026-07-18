import { render, within } from "@testing-library/react";
import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import RelatedEntries from "@/components/entry/RelatedEntries";
import {
  ENTRY_DETAIL_QUERY,
  FEATURED_QUERY,
  INDEX_QUERY,
  NOW_QUERY,
} from "@/sanity/lib/queries";

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
  title: `Entry ${id}`,
  slug: { current: id },
  ...extra,
});

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

/**
 * QA (#318, cross-layer oracle): the Index's `linkCount` PROMISES the entry page's Related
 * list — "N linked" must equal the number of entries the reader finds after clicking
 * through. The suites in queries.test.ts pin each layer alone; this one executes BOTH real
 * queries against the SAME dataset and renders the real `RelatedEntries` with the detail
 * result, so any drift between the GROQ union (`array::unique` + `defined` + self filter)
 * and the component's Set-based de-dupe fails here even if each layer's own suite stays green.
 */
describe("INDEX_QUERY linkCount ↔ RelatedEntries parity (#318 QA)", () => {
  async function indexLinkCount(
    dataset: Array<Record<string, unknown>>,
    id: string,
  ): Promise<unknown> {
    const rows: Array<{ _id: string; linkCount: unknown }> = await (
      await evaluate(parse(INDEX_QUERY), { dataset })
    ).get();
    return rows.find((r) => r._id === id)?.linkCount;
  }

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

/**
 * #329 extends the same promise to the featured card: its "N linked" readout must equal the
 * Related list on the entry's own detail page. Same oracle shape — both real queries executed
 * against ONE dataset, the real `RelatedEntries` rendered with the detail result.
 */
describe("FEATURED_QUERY linkCount ↔ RelatedEntries parity (#329)", () => {
  async function featuredLinkCount(
    dataset: Array<Record<string, unknown>>,
    id: string,
  ): Promise<unknown> {
    const rows: Array<{ _id: string; linkCount: unknown }> = await (
      await evaluate(parse(FEATURED_QUERY), { dataset })
    ).get();
    return rows.find((r) => r._id === id)?.linkCount;
  }

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

/**
 * #321 extends the same promise to `/now`: a now row's "N linked" hint must equal the
 * Related list on the now-update's own detail page. Same oracle shape — both real queries
 * executed against ONE dataset, the real `RelatedEntries` rendered with the detail result —
 * so the two copies of the distinct-neighbor expression can't drift apart from the
 * component silently.
 */
describe("NOW_QUERY linkCount ↔ RelatedEntries parity (#321)", () => {
  async function nowLinkCount(
    dataset: Array<Record<string, unknown>>,
    id: string,
  ): Promise<unknown> {
    const rows: Array<{ _id: string; linkCount: unknown }> = await (
      await evaluate(parse(NOW_QUERY), { dataset })
    ).get();
    return rows.find((r) => r._id === id)?.linkCount;
  }

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
    // QA (#321): the oracle's ragged graph covers bad EDGES; these are bad ELEMENTS. Both
    // layers see the same nulls from `related[]->` — the query must drop them via `defined(@)`
    // and the component via its `!entry` guard, or the hint counts a row nobody can see.
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
    // QA (#321): a slugless neighbor is invisible to /now's own listing (`defined(slug.current)`)
    // but the detail page still RENDERS it, unlinked. The hint promises the Related list, not the
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
