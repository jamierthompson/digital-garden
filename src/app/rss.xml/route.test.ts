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

  it("declares its own canonical URL via a namespaced atom:link rel=self", async () => {
    // RSS Best Practices Profile §5.1.1 (the W3C Feed Validator recommendation): the feed names
    // its own URL, which requires the Atom namespace on <rss>.
    const xml = await feedXml([row({ _id: "1" })]);
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    // Host-agnostic (the site URL is env-driven), but pins the full element: an absolute
    // self URL ending in /rss.xml, with the rel and type the profile requires.
    expect(xml).toMatch(
      /<atom:link href="https?:\/\/[^"]+\/rss\.xml" rel="self" type="application\/rss\+xml" \/>/,
    );
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

  /**
   * QA (#128). These pin the LITERAL RFC-822 output rather than recomputing the expectation
   * with the route's own `new Date(x).toUTCString()` expression (which couldn't catch a
   * date-parsing regression). RSS 2.0 requires RFC-822 dates (four-digit year preferred;
   * example form "Sat, 07 Sep 2002 00:00:01 GMT" — https://www.rssboard.org/rss-specification),
   * and the literal weekday proves the date-only string parsed as UTC midnight, not a
   * locale-shifted calendar day.
   */
  describe("pubDate RFC-822 conformance and XML document integrity (QA #128)", () => {
    it("emits the exact RFC-822 form for a date-only `published` — UTC midnight, correct weekday, 4-digit year, GMT", async () => {
      const xml = await feedXml([row({ _id: "1", published: "2026-07-14" })]);
      expect(xml).toContain("<pubDate>Tue, 14 Jul 2026 00:00:00 GMT</pubDate>");
    });

    it("normalizes a zoned datetime to GMT — the calendar day follows UTC, not the authored offset", async () => {
      const xml = await feedXml([
        row({ _id: "1", published: "2026-03-01T23:30:00-05:00" }),
      ]);
      expect(xml).toContain("<pubDate>Mon, 02 Mar 2026 04:30:00 GMT</pubDate>");
    });

    function parseXml(xml: string): Document {
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      // jsdom surfaces XML parse failures as an injected <parsererror> element.
      expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
      return doc;
    }

    it("stays a well-formed XML document under hostile authored text — one bad entry must never break the whole feed", async () => {
      const title = `Tom & Jerry <b>"bold"</b> ]]> 🌱 “smart” ‘quotes’`;
      const blurb = `a < b && c ]]> — café`;
      const doc = parseXml(
        await feedXml([row({ _id: "1", slug: "hostile", title, blurb })]),
      );
      // The escaping round-trips: a parser hands subscribers back the authored text verbatim.
      expect(doc.querySelector("item > title")?.textContent).toBe(title);
      expect(doc.querySelector("item > description")?.textContent).toBe(blurb);
      expect(doc.querySelector("item > pubDate")?.textContent).toBe(
        "Sun, 01 Mar 2026 00:00:00 GMT",
      );
    });

    it("an empty channel is still a well-formed RSS document", async () => {
      const doc = parseXml(await feedXml([]));
      expect(doc.documentElement.tagName).toBe("rss");
      expect(doc.documentElement.getAttribute("version")).toBe("2.0");
      expect(doc.querySelectorAll("item")).toHaveLength(0);
    });
  });
});
