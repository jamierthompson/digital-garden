import { beforeEach, describe, expect, it, vi } from "vitest";

// `cacheLife` only runs inside a real `use cache` scope (Next build); mock it so the
// route module loads and runs under Vitest.
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

// The route reads the PUBLIC client (published perspective) — mock the single fetch path.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/client", () => ({
  client: { fetch: fetchMock },
}));

import { GET } from "./route";

interface FeedRow {
  _id: string;
  title: string | null;
  slug: string | null;
  blurb: string | null;
  published: string | null;
}

function row(over: Partial<FeedRow> & { _id: string }): FeedRow {
  return {
    title: "An entry",
    slug: "an-entry",
    blurb: "A blurb.",
    published: "2026-03-01T00:00:00Z",
    ...over,
  };
}

async function feedXml(rows: FeedRow[]): Promise<string> {
  fetchMock.mockResolvedValueOnce(rows);
  const response = await GET();
  expect(response.headers.get("Content-Type")).toBe(
    "application/rss+xml; charset=utf-8",
  );
  return response.text();
}

beforeEach(() => {
  fetchMock.mockReset();
});

/**
 * The feed rescoped from projects-only to EVERY published entry (#249) — these pin the
 * route's rendering contract over the trimmed { _id, title, slug, blurb } rows: channel
 * identity, the slugless skip, XML escaping, and the null-field fallbacks. (The query's
 * own scope/projection is pinned in queries.test.ts; this is the route half.)
 */
describe("GET /rss.xml — feed rendering (QA #249)", () => {
  it("renders the rescoped garden channel identity, not the retired projects feed", async () => {
    const xml = await feedXml([row({ _id: "1" })]);
    expect(xml).toContain("<title>Jamie Thompson — Digital Garden</title>");
    expect(xml).not.toContain("— Projects");
    // The channel description names the full garden scope, now-updates included.
    expect(xml).toMatch(/<description>[^<]*now-updates[^<]*<\/description>/);
  });

  it("skips a slugless entry (no canonical URL) instead of emitting a broken <link>", async () => {
    const xml = await feedXml([
      row({ _id: "1", title: "Linked", slug: "linked" }),
      row({ _id: "2", title: "Slugless", slug: null }),
      row({ _id: "3", title: "Empty slug", slug: "" }),
    ]);
    expect(xml).toContain("<title>Linked</title>");
    expect(xml).not.toContain("Slugless");
    expect(xml).not.toContain("Empty slug");
    // Exactly one item survived.
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it("escapes XML metacharacters in the title and blurb (hostile content stays inert)", async () => {
    const xml = await feedXml([
      row({
        _id: "1",
        title: `Tom & Jerry <script>alert("x")</script>`,
        blurb: `a < b & "c" > 'd'`,
        slug: "hostile",
      }),
    ]);
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("Tom &amp; Jerry &lt;script&gt;");
    expect(xml).toContain("a &lt; b &amp;");
  });

  it("falls back to Untitled for a null title and an empty description for a null blurb", async () => {
    const xml = await feedXml([
      row({ _id: "1", title: null, blurb: null, slug: "bare" }),
    ]);
    expect(xml).toContain("<title>Untitled</title>");
    expect(xml).toContain("<description></description>");
  });

  it("renders a valid empty channel when nothing is published (no items, no crash)", async () => {
    const xml = await feedXml([]);
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });

  it("builds each item's link and permalink guid from the flat /[slug] route", async () => {
    const xml = await feedXml([row({ _id: "1", slug: "my-entry" })]);
    expect(xml).toMatch(/<link>[^<]*\/my-entry<\/link>/);
    expect(xml).toMatch(/<guid isPermaLink="true">[^<]*\/my-entry<\/guid>/);
  });

  it("stamps each item with an RFC-822 <pubDate> from the entry's published date", async () => {
    const xml = await feedXml([
      row({ _id: "1", published: "2026-03-01T00:00:00Z" }),
    ]);
    // RSS 2.0 pubDate is RFC-822; `toUTCString()` is the canonical form readers parse.
    expect(xml).toContain(
      `<pubDate>${new Date("2026-03-01T00:00:00Z").toUTCString()}</pubDate>`,
    );
  });

  it("stamps a date-only `iterated` value (no clock component) as a valid pubDate", async () => {
    // A Sanity `date` field is date-only ("2026-07-14"); it must still yield a valid RFC-822 date.
    const xml = await feedXml([row({ _id: "1", published: "2026-07-14" })]);
    expect(xml).toContain(
      `<pubDate>${new Date("2026-07-14").toUTCString()}</pubDate>`,
    );
    expect(xml).not.toContain("Invalid Date");
  });

  it("omits <pubDate> entirely for a null or unparseable date (no empty or Invalid Date element)", async () => {
    const xml = await feedXml([
      row({ _id: "1", slug: "no-date", published: null }),
      row({ _id: "2", slug: "bad-date", published: "not-a-date" }),
    ]);
    expect(xml).not.toContain("<pubDate>");
    expect(xml).not.toContain("Invalid Date");
    // Both items still render — a missing date drops only the one element, not the item.
    expect(xml.match(/<item>/g)).toHaveLength(2);
  });
});
