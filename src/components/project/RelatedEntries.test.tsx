import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RelatedEntries from "./RelatedEntries";

const entry = (over: Record<string, unknown> = {}) => ({
  _id: "x",
  title: "Title",
  slug: "some-slug",
  kind: "note",
  ...over,
});

describe("RelatedEntries", () => {
  it("renders nothing when there are no related entries or backlinks", () => {
    const { container: nullContainer } = render(
      <RelatedEntries currentId="self" related={null} backlinks={null} />,
    );
    expect(nullContainer).toBeEmptyDOMElement();

    const { container: emptyContainer } = render(
      <RelatedEntries currentId="self" related={[]} backlinks={[]} />,
    );
    expect(emptyContainer).toBeEmptyDOMElement();
  });

  it("renders the union of related + backlinks as links, de-duped by _id", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: "On gardens", slug: "on-gardens" })]}
        backlinks={[
          entry({ _id: "b", title: "On OKLCH", slug: "on-oklch" }),
          entry({ _id: "a", title: "On gardens", slug: "on-gardens" }), // duplicate of the related edge
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /related/i }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["On gardens", "On OKLCH"]);
    expect(links[0]).toHaveAttribute("href", "/work/on-gardens");
  });

  it("excludes a self-reference by _id", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "self", title: "Me", slug: "me" })]}
        backlinks={null}
      />,
    );
    expect(screen.queryByText("Me")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /related/i }),
    ).not.toBeInTheDocument();
  });

  it("filters out a dangling reference (a null element from a deleted target)", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[null, entry({ _id: "a", title: "Live", slug: "live" })]}
        backlinks={null}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Live"]);
  });

  it("renders an entry with no slug as plain text, not a dead link", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: "No route", slug: null })]}
        backlinks={null}
      />,
    );
    expect(screen.getByText("No route")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("falls back to a neutral label for an untitled entry", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[entry({ _id: "a", title: null, slug: "x" })]}
        backlinks={null}
      />,
    );
    expect(screen.getByText("Untitled entry")).toBeInTheDocument();
  });

  it("excludes a self-reference that arrives via backlinks, not just related", () => {
    // `references(^._id)` returns the current doc itself if it self-references, so the
    // self-exclusion has to cover the backlinks arm too — not only the outgoing `related`.
    render(
      <RelatedEntries
        currentId="self"
        related={null}
        backlinks={[entry({ _id: "self", title: "Me", slug: "me" })]}
      />,
    );
    expect(screen.queryByText("Me")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /related/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the outgoing `related` edge when the same _id appears in both arms (related wins, stable order)", () => {
    // The two arms dereference the same doc, so a real divergence is unlikely — but the
    // de-dupe MUST be deterministic: `related` is iterated first, so its copy wins and it
    // keeps its position ahead of the backlink-only entries.
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({ _id: "a", title: "From related", slug: "from-related" }),
        ]}
        backlinks={[
          entry({ _id: "a", title: "From backlink", slug: "from-backlink" }),
          entry({ _id: "b", title: "Backlink only", slug: "backlink-only" }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "From related",
      "Backlink only",
    ]);
    expect(links[0]).toHaveAttribute("href", "/work/from-related");
    expect(screen.queryByText("From backlink")).not.toBeInTheDocument();
  });

  it("filters a dangling null element interleaved in the backlinks arm", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={null}
        backlinks={[
          entry({ _id: "a", title: "Live one", slug: "live-one" }),
          null,
          entry({ _id: "b", title: "Live two", slug: "live-two" }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Live one", "Live two"]);
  });

  it("renders nothing when every candidate is filtered out across both arms", () => {
    // A ragged graph: outgoing edge is a deleted target (null), the only incoming edge is
    // the doc itself. Nothing survives → no empty "Related" heading.
    const { container } = render(
      <RelatedEntries
        currentId="self"
        related={[null]}
        backlinks={[entry({ _id: "self", title: "Me", slug: "me" })]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("preserves related-before-backlinks order with multiple entries in each arm", () => {
    render(
      <RelatedEntries
        currentId="self"
        related={[
          entry({ _id: "r1", title: "Related one", slug: "r1" }),
          entry({ _id: "r2", title: "Related two", slug: "r2" }),
        ]}
        backlinks={[
          entry({ _id: "b1", title: "Backlink one", slug: "b1" }),
          entry({ _id: "b2", title: "Backlink two", slug: "b2" }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Related one",
      "Related two",
      "Backlink one",
      "Backlink two",
    ]);
  });
});
