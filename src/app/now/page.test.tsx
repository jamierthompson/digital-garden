import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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
      tended: "2026-07-01",
      summary: "IA rework.",
    },
    {
      _id: "2",
      title: "Proving the engine",
      slug: "now-jun-2026",
      tended: "2026-06-15",
      summary: "Seeding themes.",
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

import type { NOW_QUERY_RESULT } from "../../../sanity.types";

import NowPage from "./page";

// Each test starts from a clean mock (no leftover queued resolutions between suites).
beforeEach(() => {
  fetchMock.mockReset();
});

// Derived from the TypeGen'd result rather than hand-mirrored: a field added to (or dropped
// from) NOW_QUERY breaks this fixture at typecheck instead of silently leaving the new field
// untested — the hole that let `linkCount` ship with no page-level coverage.
type NowRow = NOW_QUERY_RESULT[number];

function row(over: Partial<NowRow> & { _id: string }): NowRow {
  return {
    title: "An update",
    slug: "an-update",
    tended: "2026-07-01",
    summary: null,
    linkCount: 0,
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
    expect(screen.getByText("Last tended July 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Last tended June 15, 2026")).toBeInTheDocument();
  });

  it("keeps the nownownow.com footnote link", async () => {
    render(await NowPage());
    expect(screen.getByRole("link", { name: /now page/i })).toHaveAttribute(
      "href",
      "https://nownownow.com/about",
    );
  });

  describe("adversarial QA", () => {
    it("keeps rel=noopener noreferrer AND gains the accent treatment on the external footnote link", async () => {
      render(await NowPage());
      const link = screen.getByRole("link", { name: /now page/i });
      // The migration swapped <a className> for <TextLink>; rel must pass through the
      // primitive untouched and the accent ink bundle must actually be selected.
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("data-variant", "accent");
      expect(link.tagName).toBe("A");
    });
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

  it("omits the <time> stamp when tended is null (a now-update without a date)", async () => {
    // `tended` is an optional Sanity `date` — a now-update may have none. No date → no
    // <time>, but the update still renders and links.
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: "Dateless", slug: "dateless", tended: null }),
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
        tended: "2026-01-01",
      }),
    ]);
    render(await NowPage());
    // Formatted from `${iso}T00:00:00Z` with timeZone: "UTC" — Jan 1, not Dec 31.
    const time = screen.getByText("Last tended January 1, 2026");
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

/**
 * QA (#321): the slice's ONLY production change is `linkCount={update.linkCount}` on the row —
 * and nothing pinned it. Deleting that prop left all 176 tests green: the added suites cover
 * NOW_QUERY's projection and the parity oracle, but neither renders the page, so the query
 * could project the hint forever while `/now` never showed it. These tests fail if the prop is
 * dropped, which is the whole acceptance criterion of the issue.
 */
describe("NowPage — the linkCount hint reaches the row (#321 QA)", () => {
  it("renders the backlink hint on a now row whose update has neighbors", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: "Linked update", slug: "linked", linkCount: 3 }),
    ]);
    render(await NowPage());
    expect(screen.getByText("3 Related")).toBeInTheDocument();
  });

  it("threads each row's OWN count — the hint is per-update, not shared", async () => {
    // A single mis-threaded prop (e.g. hoisted out of the map) would show one count on both.
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: "Three", slug: "three", linkCount: 3 }),
      row({ _id: "b", title: "One", slug: "one", linkCount: 1 }),
    ]);
    render(await NowPage());
    expect(screen.getByText("3 Related")).toBeInTheDocument();
    expect(screen.getByText("1 Related")).toBeInTheDocument();
  });

  it("shows NO hint for an unlinked update — zero renders nothing, never '0 Related'", async () => {
    fetchMock.mockResolvedValueOnce([
      row({ _id: "a", title: "Lonely", slug: "lonely", linkCount: 0 }),
    ]);
    render(await NowPage());
    expect(screen.getByRole("link", { name: /lonely/i })).toBeInTheDocument();
    // Both vocabularies: the hint now reads "N Related" — /linked/ alone went vacuous at
    // the label rename, so a rendered "0 Related" would have slipped past it.
    expect(screen.queryByText(/(linked|related)/i)).not.toBeInTheDocument();
  });

  it("survives a stale result shape with no linkCount at all — no hint, no crash", async () => {
    // A cached/older payload predating the projection: `update.linkCount` is undefined. The
    // TypeGen'd type says `number`, so only runtime tolerance protects the page here.
    fetchMock.mockResolvedValueOnce([
      {
        _id: "a",
        title: "Stale",
        slug: "stale",
        tended: "2026-07-01",
        summary: null,
      },
    ]);
    render(await NowPage());
    expect(screen.getByRole("link", { name: /stale/i })).toBeInTheDocument();
    expect(screen.queryByText(/(linked|related)/i)).not.toBeInTheDocument();
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
    const html = renderToStaticMarkup(await NowPage());
    expect(seedSpy).toHaveBeenCalledWith("now");
    expect(html).toContain(":root{");
  });
});
