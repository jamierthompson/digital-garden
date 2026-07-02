import { render, screen } from "@testing-library/react";
import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import RelatedEntries from "@/components/project/RelatedEntries";

import { PROJECT_DETAIL_QUERY } from "./queries";

// The backlink graph, tested by EXECUTION — not string assertions.
//
// queries.test.ts pins the query STRING (it contains `references(^._id)`) and
// RelatedEntries.test.tsx pins the component LOGIC (union / dedupe / self-exclude). Neither
// actually RUNS `references()`, so a regression that leaves the string intact but breaks
// resolution (wrong `^` scope, dropped `->`, a Sanity/GROQ behavior change) would sail past
// both. This test closes that gap: it evaluates the REAL `PROJECT_DETAIL_QUERY` against an
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
    kind: "project",
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
  const tree = parse(PROJECT_DETAIL_QUERY);
  const value = await evaluate(tree, { dataset: DATASET, params: { slug } });
  return value.get();
}

describe("PROJECT_DETAIL_QUERY backlink graph (executed via groq-js)", () => {
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
    // The three real neighbours — hub-self excluded, ghost filtered, island absent,
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
    // detail query resolves backlinks for a `now`-kind doc, not just a project.
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
