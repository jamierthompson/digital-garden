import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IndexPage is an async Server Component reading INDEX_QUERY. Mock the single read path;
// `vi.hoisted` lets a per-test fixture be swapped before the hoisted factory runs.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));

// The page also resolves its own `pageThemes.browse` seed via `sitePageThemeSeed`. These tests
// cover the Index's CONTENT rendering, so stub the seed helper to a fixed null — its resolution is
// covered by `sitePageSeed.test.ts`. Kept as a HOISTED spy (not an inline fn) so a nested suite can
// pin that `IndexPage` asks for its OWN `browse` key. Stubbing also keeps the helper's `server-only`
// import out of this suite.
const { seedSpy } = vi.hoisted(() => ({
  seedSpy: vi.fn(async () => null),
}));
vi.mock("@/components/theme/sitePageSeed", () => ({
  sitePageThemeSeed: seedSpy,
}));

import IndexPage from "./page";

interface IndexRow {
  _id: string;
  title: string | null;
  slug: string | null;
  kind: string | null;
  stage: string | null;
  iterated: string | null;
  summary: string | null;
  linkCount: number;
}

function row(over: Partial<IndexRow> & { _id: string }): IndexRow {
  return {
    title: "A row",
    slug: "a-row",
    // Default to an INDEXED kind (essay) — a row whose kind matches no section renders
    // nothing, a misleading default for the generic-behaviour tests.
    kind: "essay",
    stage: "sketch",
    iterated: null,
    summary: null,
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
    // KIND_SECTIONS (demo → essay → note), never the query's kind-asc.
    fetchMock.mockResolvedValueOnce([
      row({ _id: "no1", kind: "note", title: "A note", slug: "note-1" }),
      row({ _id: "p1", kind: "demo", title: "A demo", slug: "proj-1" }),
      row({ _id: "e1", kind: "essay", title: "An essay", slug: "essay-1" }),
    ]);
    render(await IndexPage());
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Demos", "Essays", "Notes"]);
  });

  it("lists a note under its own Notes section (#314)", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "no1", kind: "note", title: "A listed note", slug: "note-1" }),
    ]);
    render(await IndexPage());
    const section = screen.getByRole("region", { name: "Notes" });
    expect(
      within(section).getByRole("link", { name: /a listed note/i }),
    ).toHaveAttribute("href", "/note-1");
  });

  it("never lists a now-update — the dated stream is /now's surface (#314)", async () => {
    // INDEX_QUERY filters `kind == "now"` out, so the page should never see one. This pins the
    // page's own allowlist as the second line of defense: a `now` row that reaches it anyway
    // (a drifted fetch, a raw API path) gets no section and no row.
    fetchMock.mockResolvedValueOnce([
      row({ _id: "p1", kind: "demo", title: "A demo", slug: "proj-1" }),
      row({
        _id: "n1",
        kind: "now",
        title: "A now update",
        slug: "now-1",
        stage: null,
      }),
    ]);
    render(await IndexPage());
    // The demo still lists…
    expect(
      screen.getByRole("heading", { level: 2, name: "Demos" }),
    ).toBeInTheDocument();
    // …but the now-update gets no section and no row.
    expect(screen.queryByRole("heading", { name: "Now" })).toBeNull();
    expect(screen.queryByText(/a now update/i)).toBeNull();
  });

  it("omits a kind section entirely when it has no entries", async () => {
    fetchMock.mockResolvedValueOnce([
      row({
        _id: "p1",
        kind: "demo",
        title: "Only a demo",
        slug: "proj-1",
      }),
    ]);
    render(await IndexPage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Demos" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Essays" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Notes" })).toBeNull();
  });

  it("links each row with a slug and renders a slugless row as plain text", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", kind: "essay", title: "Has a slug", slug: "has-slug" }),
      row({ _id: "b", kind: "essay", title: "No slug yet", slug: null }),
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
      row({ _id: "a", kind: "essay", title: null, slug: "x" }),
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
        kind: "demo",
        title: "Shipped thing",
        slug: "a",
        stage: "shipped",
      }),
      row({
        _id: "b",
        kind: "note",
        title: "Stageless thing",
        slug: "b",
        stage: null,
      }),
    ]);
    render(await IndexPage());
    expect(screen.getByText("shipped")).toBeInTheDocument();
    // The stageless row shows no badge text at all — not an empty or default one.
    expect(screen.queryByText("sketch")).toBeNull();
  });

  it("shows the backlink hint only when linkCount > 0", async () => {
    fetchMock.mockResolvedValueOnce([
      row({
        _id: "a",
        kind: "essay",
        title: "Linked",
        slug: "a",
        linkCount: 3,
      }),
      row({
        _id: "b",
        kind: "essay",
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
      row({ _id: "p", kind: "demo", title: "P", slug: "p" }),
    ]);
    render(await IndexPage());
    // The <section aria-labelledby="section-demo"> is named by its <h2 id="section-demo">.
    const section = screen.getByRole("region", { name: "Demos" });
    expect(section).toBeInTheDocument();
    expect(
      within(section).getByRole("heading", { level: 2, name: "Demos" }),
    ).toBeInTheDocument();
  });

  it("renders exactly one h1 (the page title) above the group headings", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "p", kind: "demo", title: "P", slug: "p" }),
    ]);
    render(await IndexPage());
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Index");
  });
});

/**
 * QA (#312): KIND_SECTIONS is an allowlist. A row whose kind the code doesn't recognize
 * (drifted data, a kind authored before its code ships) matches no section — these pin that
 * the drop is deliberate and total, never a crash or a stray unlabeled row.
 */
describe("IndexPage (/browse) — rows with an unrecognized kind", () => {
  it("silently drops an unrecognized-kind row — no section, no stray row", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "d1", kind: "demo", title: "A listed demo", slug: "d-1" }),
      row({
        _id: "b1",
        kind: "bookmark",
        title: "An unclassified row",
        slug: "b-1",
      }),
    ]);
    render(await IndexPage());
    // The known kind lists under its section…
    expect(
      screen.getByRole("heading", { level: 2, name: "Demos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A listed demo")).toBeInTheDocument();
    // …the unrecognized row gets no section and no row — dropped, not crashed on.
    expect(screen.queryByRole("heading", { name: "Bookmarks" })).toBeNull();
    expect(screen.queryByText("An unclassified row")).toBeNull();
  });

  it('drops a NULL-kind row — the query\'s `kind != "now"` filter passes a kindless doc through', async () => {
    // Not hypothetical: GROQ `null != "now"` is true (pinned executed in queries.test.ts),
    // so a kindless doc reaches this page as `kind: null`. The allowlist must drop it
    // without crashing or stranding a stray row.
    fetchMock.mockResolvedValueOnce([
      row({ _id: "d1", kind: "demo", title: "A listed demo", slug: "d-1" }),
      row({
        _id: "k1",
        kind: null,
        title: "A kindless row",
        slug: "k-1",
        stage: null,
      }),
    ]);
    render(await IndexPage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Demos" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("A kindless row")).toBeNull();
  });

  it("shows the empty state — the WHOLE index goes dark — when no row carries a known kind", async () => {
    // An allowlist can drop everything: if no row's kind is recognized, the reader sees
    // "Nothing published yet." on a garden that IS published. Pinned so the total-drop
    // shape is a known, tested state rather than an accident.
    fetchMock.mockResolvedValueOnce([
      row({
        _id: "b1",
        kind: "bookmark",
        title: "Unclassified one",
        slug: "b-1",
      }),
      row({
        _id: "b2",
        kind: "bookmark",
        title: "Unclassified two",
        slug: "b-2",
      }),
    ]);
    render(await IndexPage());
    expect(screen.getByText(/nothing published yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

describe("IndexPage (/browse) — theme mount wiring", () => {
  beforeEach(() => {
    seedSpy.mockClear();
  });

  it("resolves its OWN `browse` seed key and mounts a PageTheme init script", async () => {
    // #175: every site route stamps its authored seed on `<html>`. The `SitePageKey` type keeps
    // the key a valid `pageThemes` field, but NOT the RIGHT one — a copy-paste ("about"/"system")
    // would still compile. Pin that IndexPage asks for `browse`, and that the (synchronous)
    // PageTheme actually mounts its parse-time init script in the rendered shell.
    fetchMock.mockResolvedValueOnce([
      row({ _id: "p", kind: "demo", title: "P", slug: "p" }),
    ]);
    const html = renderToStaticMarkup(await IndexPage());
    expect(seedSpy).toHaveBeenCalledWith("browse");
    // PageTheme bakes its :root <style> into the server markup (React hoists it into <head>).
    expect(html).toContain(":root{");
  });
});
