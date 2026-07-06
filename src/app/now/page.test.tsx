import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NowPage is an async Server Component reading NOW_QUERY. Mock the single read path so a
// per-test fixture can be swapped; `vi.hoisted` lets the fixture + mock fn exist before the
// hoisted `vi.mock` factory runs.
const { NOW_FIXTURE, fetchMock } = vi.hoisted(() => ({
  NOW_FIXTURE: [
    {
      _id: "1",
      title: "Flattening the routes",
      slug: "now-jul-2026",
      iterated: "2026-07-01",
      blurb: "IA rework.",
    },
    {
      _id: "2",
      title: "Proving the engine",
      slug: "now-jun-2026",
      iterated: "2026-06-15",
      blurb: "Seeding brands.",
    },
  ],
  fetchMock: vi.fn(),
}));

vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));

// The page also resolves its own `pageThemes.now` seed via `sitePageThemeSeed`. These tests cover
// the Now stream's CONTENT rendering, so stub the seed helper to a fixed null — its resolution is
// covered by `sitePageSeed.test.ts`. Kept as a HOISTED spy (not an inline fn) so a nested suite can
// pin that `NowPage` asks for its OWN `now` key. Stubbing also keeps the helper's `server-only`
// import out of this suite.
const { seedSpy } = vi.hoisted(() => ({
  seedSpy: vi.fn(async () => null),
}));
vi.mock("@/components/theme/sitePageSeed", () => ({
  sitePageThemeSeed: seedSpy,
}));

import NowPage from "./page";

// Each test starts from a clean mock (no leftover queued resolutions between suites).
beforeEach(() => {
  fetchMock.mockReset();
});

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

describe("Now page (Sanity-driven stream)", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(NOW_FIXTURE);
  });

  it("renders each now-update linking to its flat /[slug]", async () => {
    render(await NowPage());
    expect(
      screen.getByRole("link", { name: /flattening the routes/i }),
    ).toHaveAttribute("href", "/now-jul-2026");
    expect(
      screen.getByRole("link", { name: /proving the engine/i }),
    ).toHaveAttribute("href", "/now-jun-2026");
  });

  it("stamps each update with its formatted UTC date", async () => {
    render(await NowPage());
    expect(screen.getByText("July 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("June 15, 2026")).toBeInTheDocument();
  });

  it("keeps the nownownow.com footnote link", async () => {
    render(await NowPage());
    expect(screen.getByRole("link", { name: /now page/i })).toHaveAttribute(
      "href",
      "https://nownownow.com/about",
    );
  });
});

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

describe("NowPage (/now) — theme mount wiring", () => {
  it("resolves its OWN `now` seed key and mounts a PageTheme init script", async () => {
    // #175: the `/now` INDEX stamps `pageThemes.now` on `<html>` — the SAME seed a `now`-kind
    // entry inherits (ENTRY_DETAIL_QUERY's kind-gated `themeSeed`), so an update wears its index's
    // theme. Pin that NowPage asks for `now` (not a sibling key the type would also accept) and
    // that the synchronous PageTheme mounts its parse-time init script.
    seedSpy.mockClear();
    fetchMock.mockResolvedValueOnce([row({ _id: "a" })]);
    const { container } = render(await NowPage());
    expect(seedSpy).toHaveBeenCalledWith("now");
    const initScript = [...container.querySelectorAll("script")].find((s) =>
      s.innerHTML.includes("setProperty"),
    );
    expect(initScript).toBeDefined();
  });
});
