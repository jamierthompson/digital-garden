import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// IndexPage is an async Server Component reading INDEX_QUERY. Mock the single read path;
// `vi.hoisted` lets a per-test fixture be swapped before the hoisted factory runs.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));

import IndexPage from "./page";

interface IndexRow {
  _id: string;
  title: string | null;
  slug: string | null;
  kind: string | null;
  stage: string | null;
  iterated: string | null;
  blurb: string | null;
  linkCount: number;
}

function row(over: Partial<IndexRow> & { _id: string }): IndexRow {
  return {
    title: "A row",
    slug: "a-row",
    kind: "note",
    stage: "sketch",
    iterated: null,
    blurb: null,
    linkCount: 0,
    ...over,
  };
}

describe("IndexPage (/browse) — the folded Index", () => {
  it("shows the empty state when nothing is published", async () => {
    fetchMock.mockResolvedValueOnce([]);
    render(await IndexPage());
    expect(screen.getByText(/nothing published yet/i)).toBeInTheDocument();
    // The empty state must not emit any group heading.
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("groups entries under their kind headings in display order, omitting empty kinds", async () => {
    // Fetch order is deliberately NOT the display order — display order is fixed by
    // KIND_SECTIONS (project → essay → note → now), never the query's kind-asc.
    fetchMock.mockResolvedValueOnce([
      row({
        _id: "n1",
        kind: "now",
        title: "A now update",
        slug: "now-1",
        stage: null,
      }),
      row({ _id: "p1", kind: "project", title: "A project", slug: "proj-1" }),
      row({ _id: "e1", kind: "essay", title: "An essay", slug: "essay-1" }),
      row({ _id: "no1", kind: "note", title: "A note", slug: "note-1" }),
    ]);
    render(await IndexPage());
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Projects", "Essays", "Notes", "Now"]);
  });

  it("omits a kind section entirely when it has no entries", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "no1", kind: "note", title: "Only a note", slug: "note-1" }),
    ]);
    render(await IndexPage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Notes" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Projects" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Essays" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Now" })).toBeNull();
  });

  it("links each row with a slug and renders a slugless row as plain text", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", kind: "note", title: "Has a slug", slug: "has-slug" }),
      row({ _id: "b", kind: "note", title: "No slug yet", slug: null }),
    ]);
    render(await IndexPage());
    expect(screen.getByRole("link", { name: /has a slug/i })).toHaveAttribute(
      "href",
      "/has-slug",
    );
    // A slugless (e.g. draft) row must not become a dead link.
    expect(screen.queryByRole("link", { name: /no slug yet/i })).toBeNull();
    expect(screen.getByText("No slug yet")).toBeInTheDocument();
  });

  it("falls back to a neutral label for an untitled row", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", kind: "note", title: null, slug: "x" }),
    ]);
    render(await IndexPage());
    expect(
      screen.getByRole("link", { name: /untitled entry/i }),
    ).toBeInTheDocument();
  });

  it("renders the stage badge only when a stage is set", async () => {
    fetchMock.mockResolvedValueOnce([
      row({
        _id: "a",
        kind: "project",
        title: "Shipped thing",
        slug: "a",
        stage: "shipped",
      }),
      row({
        _id: "b",
        kind: "now",
        title: "Now thing",
        slug: "b",
        stage: null,
      }),
    ]);
    render(await IndexPage());
    expect(screen.getByText("shipped")).toBeInTheDocument();
    // The now row (null stage) shows no badge text.
    expect(screen.queryByText("sketch")).toBeNull();
  });

  it("shows the backlink hint only when linkCount > 0", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", kind: "note", title: "Linked", slug: "a", linkCount: 3 }),
      row({
        _id: "b",
        kind: "note",
        title: "Unlinked",
        slug: "b",
        linkCount: 0,
      }),
    ]);
    render(await IndexPage());
    expect(screen.getByText(/3 linked/i)).toBeInTheDocument();
    // Zero links → no "0 linked" noise.
    expect(screen.queryByText(/0 linked/i)).toBeNull();
  });

  it("gives every group section an accessible name wired to its heading id", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "p", kind: "project", title: "P", slug: "p" }),
    ]);
    render(await IndexPage());
    // The <section aria-labelledby="section-project"> is named by its <h2 id="section-project">.
    const section = screen.getByRole("region", { name: "Projects" });
    expect(section).toBeInTheDocument();
    expect(
      within(section).getByRole("heading", { level: 2, name: "Projects" }),
    ).toBeInTheDocument();
  });

  it("renders exactly one h1 (the page title) above the group headings", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "p", kind: "project", title: "P", slug: "p" }),
    ]);
    render(await IndexPage());
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Index");
  });
});
