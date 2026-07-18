import { describe, expect, it } from "vitest";

import { distinctNeighbors } from "./distinctNeighbors";

const doc = (id: string) => ({ _id: id });

describe("distinctNeighbors", () => {
  it("unions both arms, related first, preserving order", () => {
    expect(
      distinctNeighbors("self", [doc("a"), doc("b")], [doc("c")]).map(
        (n) => n._id,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("de-dupes an entry that appears in both arms — the related copy wins", () => {
    const fromRelated = { _id: "a", arm: "related" };
    const fromBacklink = { _id: "a", arm: "backlink" };
    const result = distinctNeighbors("self", [fromRelated], [fromBacklink]);
    expect(result).toEqual([fromRelated]);
  });

  it("drops a self-reference from either arm", () => {
    expect(distinctNeighbors("self", [doc("self")], [doc("self")])).toEqual([]);
  });

  it("drops null elements (a dangling reference dereferences to null)", () => {
    expect(
      distinctNeighbors("self", [null, doc("a")], [null]).map((n) => n._id),
    ).toEqual(["a"]);
  });

  it("returns [] for null arms and for empty arms", () => {
    expect(distinctNeighbors("self", null, null)).toEqual([]);
    expect(distinctNeighbors("self", [], [])).toEqual([]);
  });

  it("collapses duplicate ids within one arm", () => {
    expect(
      distinctNeighbors("self", [doc("a"), doc("a")], null).map((n) => n._id),
    ).toEqual(["a"]);
  });
});
