import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Home is an async Server Component reading FEATURED_QUERY. Mock the single read path so a
// per-test fixture can be swapped. cardSwatches runs for REAL on each fixture's brandColor —
// it's pure/defensive, so the null/garbage-brand cases exercise the true fallback path.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));

import Home from "./page";

interface FeaturedRow {
  _id: string;
  title: string | null;
  slug: string | null;
  kind: string | null;
  stage: string | null;
  blurb: string | null;
  brandColor: unknown;
  fontKey: string | null;
}

function row(over: Partial<FeaturedRow> & { _id: string }): FeaturedRow {
  return {
    title: "A card",
    slug: "a-card",
    kind: "project",
    stage: "prototype",
    blurb: null,
    brandColor: "oklch(0.7 0.15 70)",
    fontKey: "newsreader",
    ...over,
  };
}

describe("Home (/) — edges & boundaries", () => {
  it("omits the Featured section entirely when nothing is promoted", async () => {
    fetchMock.mockResolvedValueOnce([]);
    render(await Home());
    // Hero + wayfinding survive; no empty "Featured" heading.
    expect(
      screen.getByRole("heading", { level: 1, name: /jamie thompson/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /featured/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: /browse everything/i }),
    ).toHaveAttribute("href", "/browse");
  });

  it("brands a featured entry with a NULL brandColor without throwing (fallback swatches)", async () => {
    // featuredRank can promote ANY kind — a featured note/now has no brandColor. The card
    // must still render (fallback palette), never crash the whole front door.
    fetchMock.mockResolvedValueOnce([
      row({
        _id: "a",
        kind: "note",
        title: "Featured note",
        slug: "featured-note",
        brandColor: null,
      }),
    ]);
    render(await Home());
    const link = screen.getByRole("link", { name: /featured note/i });
    expect(link).toHaveAttribute("href", "/featured-note");
    // The inline swatch overrides are present and baked (not thrown away).
    const card = link.closest("li");
    expect(card).not.toBeNull();
    expect(card!.getAttribute("style") ?? "").toContain("--surface");
  });

  it("survives a hostile/garbage brandColor on a featured card", async () => {
    fetchMock.mockResolvedValueOnce([
      row({
        _id: "a",
        title: "Garbage brand",
        slug: "g",
        brandColor: "not-a-color",
      }),
    ]);
    render(await Home());
    expect(
      screen.getByRole("link", { name: /garbage brand/i }),
    ).toBeInTheDocument();
  });

  it("renders a slugless featured card as a non-link heading, never a dead link", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: "No route card", slug: null }),
    ]);
    render(await Home());
    expect(screen.queryByRole("link", { name: /no route card/i })).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: /no route card/i }),
    ).toBeInTheDocument();
  });

  it("falls back to a neutral label for an untitled featured card", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: null, slug: "x" }),
    ]);
    render(await Home());
    expect(
      screen.getByRole("link", { name: /untitled entry/i }),
    ).toBeInTheDocument();
  });

  it("keeps a clean heading hierarchy: one h1, an h2 section, h3 card titles", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: "Card A", slug: "a" }),
      row({ _id: "b", title: "Card B", slug: "b" }),
    ]);
    render(await Home());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: /featured/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });
});
