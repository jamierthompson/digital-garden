import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// NowPage is an async Server Component reading NOW_QUERY. Mock the single read path so a
// per-test fixture can be swapped; `vi.hoisted` lets the mock fn exist before the factory.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));

import NowPage from "./page";

interface NowRow {
  _id: string;
  title: string | null;
  slug: string | null;
  iterated: string | null;
  blurb: string | null;
}

function row(over: Partial<NowRow> & { _id: string }): NowRow {
  return {
    title: "An update",
    slug: "an-update",
    iterated: "2026-07-01",
    blurb: null,
    ...over,
  };
}

describe("NowPage — edges & boundaries", () => {
  it("shows the empty state and no list when the stream is empty", async () => {
    fetchMock.mockResolvedValueOnce([]);
    render(await NowPage());
    expect(screen.getByText(/no now-updates yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
    // The footnote survives even with no updates.
    expect(screen.getByRole("link", { name: /now page/i })).toHaveAttribute(
      "href",
      "https://nownownow.com/about",
    );
  });

  it("omits the <time> stamp when iterated is null (a now-update without a date)", async () => {
    // `iterated` is an optional Sanity `date` — a now-update may have none. No date → no
    // <time>, but the update still renders and links.
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: "Dateless", slug: "dateless", iterated: null }),
    ]);
    const { container } = render(await NowPage());
    expect(container.querySelector("time")).toBeNull();
    expect(screen.getByRole("link", { name: /dateless/i })).toHaveAttribute(
      "href",
      "/dateless",
    );
  });

  it("renders a slugless update as plain text, never a dead link", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: "No route", slug: null }),
    ]);
    render(await NowPage());
    expect(screen.queryByRole("link", { name: /no route/i })).toBeNull();
    expect(screen.getByText("No route")).toBeInTheDocument();
  });

  it("falls back to a neutral label for an untitled update", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: null, slug: "x" }),
    ]);
    render(await NowPage());
    expect(
      screen.getByRole("link", { name: /untitled update/i }),
    ).toBeInTheDocument();
  });

  it("pins the date to UTC (a YYYY-MM-DD renders as that calendar day, no TZ rollback)", async () => {
    fetchMock.mockResolvedValueOnce([
      row({
        _id: "a",
        title: "Jan first",
        slug: "jan-1",
        iterated: "2026-01-01",
      }),
    ]);
    render(await NowPage());
    // Formatted from `${iso}T00:00:00Z` with timeZone: "UTC" — Jan 1, not Dec 31.
    expect(screen.getByText("January 1, 2026")).toBeInTheDocument();
    const time = screen.getByText("January 1, 2026");
    expect(time.tagName.toLowerCase()).toBe("time");
    expect(time).toHaveAttribute("datetime", "2026-01-01");
  });

  it("renders exactly one h1 (Now)", async () => {
    fetchMock.mockResolvedValueOnce([row({ _id: "a" })]);
    render(await NowPage());
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Now");
  });
});
