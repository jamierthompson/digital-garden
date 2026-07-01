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
});
