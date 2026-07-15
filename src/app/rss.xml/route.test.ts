import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  summary: string | null;
  published: string | null;
}

function row(over: Partial<FeedRow> & { _id: string }): FeedRow {
  return {
    title: "An entry",
    slug: "an-entry",
    summary: "A summary.",
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

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  // jsdom surfaces XML parse failures as an injected <parsererror> element.
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
}

beforeEach(() => {
  fetchMock.mockReset();
});

/**
 * The feed rescoped from projects-only to EVERY published entry (#249) — these pin the
 * route's rendering contract over the trimmed { _id, title, slug, summary } rows: channel
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
    // RSS Best Practices Profile self-link guidance (rssboard.org/rss-profile), the W3C Feed
    // Validator recommendation: the feed names its own URL, which requires the Atom namespace on <rss>.
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

  it("escapes XML metacharacters in the title and summary (hostile content stays inert)", async () => {
    const xml = await feedXml([
      row({
        _id: "1",
        title: `Tom & Jerry <script>alert("x")</script>`,
        summary: `a < b & "c" > 'd'`,
        slug: "hostile",
      }),
    ]);
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("Tom &amp; Jerry &lt;script&gt;");
    expect(xml).toContain("a &lt; b &amp;");
  });

  it("falls back to Untitled for a null title and an empty description for a null summary", async () => {
    const xml = await feedXml([
      row({ _id: "1", title: null, summary: null, slug: "bare" }),
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

    it("stays a well-formed XML document under hostile authored text — one bad entry must never break the whole feed", async () => {
      const title = `Tom & Jerry <b>"bold"</b> ]]> 🌱 “smart” ‘quotes’`;
      const summary = `a < b && c ]]> — café`;
      const doc = parseXml(
        await feedXml([row({ _id: "1", slug: "hostile", title, summary })]),
      );
      // The escaping round-trips: a parser hands subscribers back the authored text verbatim.
      expect(doc.querySelector("item > title")?.textContent).toBe(title);
      expect(doc.querySelector("item > description")?.textContent).toBe(
        summary,
      );
      expect(doc.querySelector("item > pubDate")?.textContent).toBe(
        "Sun, 01 Mar 2026 00:00:00 GMT",
      );
    });

    it("the atom:link self declaration RESOLVES in the Atom namespace and sits inside <channel>", async () => {
      // The regex test above pins the serialized text; this proves the namespace semantics a
      // reader actually consumes — an undeclared prefix would be a parse error, and a typo'd
      // namespace URI would still match the regex while breaking every namespace-aware reader.
      const doc = parseXml(await feedXml([row({ _id: "1" })]));
      const self = doc.getElementsByTagNameNS(
        "http://www.w3.org/2005/Atom",
        "link",
      )[0];
      expect(self).toBeDefined();
      expect(self.getAttribute("rel")).toBe("self");
      expect(self.getAttribute("type")).toBe("application/rss+xml");
      expect(self.parentElement?.tagName).toBe("channel");
      // The self href is the channel's own site URL plus the feed path — never a garbage
      // `undefined/rss.xml` (an unset/empty env falls back to a real absolute URL).
      const siteUrl = doc.querySelector("channel > link")?.textContent;
      expect(self.getAttribute("href")).toBe(`${siteUrl}/rss.xml`);
      expect(self.getAttribute("href")).toMatch(/^https?:\/\//);
    });

    it("an empty channel is still a well-formed RSS document", async () => {
      const doc = parseXml(await feedXml([]));
      expect(doc.documentElement.tagName).toBe("rss");
      expect(doc.documentElement.getAttribute("version")).toBe("2.0");
      expect(doc.querySelectorAll("item")).toHaveLength(0);
    });
  });

  /**
   * Feed hardening (QA #288 / #289): the two failure modes an adversarial content write can
   * trigger — an XML-illegal control character that would reject the whole feed, and a
   * trailing-slash site URL that would double every derived slash.
   */
  describe("feed hardening (QA #288 / #289)", () => {
    // The #289 test stubs the env and re-imports the route; clean up in afterEach so a
    // mid-test assertion failure can't leak the stubbed env into later tests.
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("survives XML-illegal control characters in a summary — the feed still parses (#288)", async () => {
      // Reachable only via a raw Content Lake write, never Studio typing: even escaped, a
      // C0 control / DEL / lone surrogate / U+FFFE would make the whole document reject.
      const summary = "clean\x00\x01\x08\x0B\x0C\x1F\x7F\uFFFE\uFFFFtext";
      const doc = parseXml(
        await feedXml([row({ _id: "1", slug: "ctrl", summary })]),
      );
      expect(doc.querySelector("item > description")?.textContent).toBe(
        "cleantext",
      );
    });

    it("keeps a legal astral character while dropping a lone surrogate in a title (#288)", async () => {
      const doc = parseXml(
        await feedXml([
          row({ _id: "1", slug: "astral", title: "seed \u{1F331}\uD800 end" }),
        ]),
      );
      expect(doc.querySelector("item > title")?.textContent).toBe(
        "seed \u{1F331} end",
      );
    });

    it("normalizes a trailing-slash NEXT_PUBLIC_SITE_URL so no derived URL doubles the slash (#289)", async () => {
      // SITE_URL is read once at module load, so re-import the route under a stubbed env.
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com/");
      vi.resetModules();
      const { GET } = await import("./route");
      fetchMock.mockResolvedValueOnce([row({ _id: "1", slug: "post" })]);
      const xml = await (await GET()).text();
      const doc = parseXml(xml);

      expect(doc.querySelector("channel > link")?.textContent).toBe(
        "https://example.com",
      );
      const self = doc.getElementsByTagNameNS(
        "http://www.w3.org/2005/Atom",
        "link",
      )[0];
      expect(self.getAttribute("href")).toBe("https://example.com/rss.xml");
      expect(doc.querySelector("item > link")?.textContent).toBe(
        "https://example.com/post",
      );
      expect(doc.querySelector("item > guid")?.textContent).toBe(
        "https://example.com/post",
      );
      // The one invariant the whole fix exists to protect: no `//` after the authority.
      expect(xml).not.toMatch(/example\.com\/\//);
    });
  });

  /**
   * Adversarial QA: the boundary cases the hardening suite above doesn't pin — guid
   * stability on the already-deployed feed, degenerate env values, and authored text
   * that strips to nothing.
   */
  describe("adversarial QA", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    /** Re-import the route under a stubbed env (SITE_URL is read once at module load). */
    async function feedXmlWithEnv(
      siteUrl: string,
      rows: FeedRow[],
    ): Promise<string> {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
      vi.resetModules();
      const { GET } = await import("./route");
      fetchMock.mockResolvedValueOnce(rows);
      return (await GET()).text();
    }

    it("normalization never CHANGES a guid the deployed feed already served (#289)", async () => {
      // A changed guid re-delivers every item to every subscriber. Prod's env has no
      // trailing slash, so stripping must be a no-op there — and the trailing-slash
      // form must converge on the byte-identical guid, not mint a new one.
      const guidOf = (xml: string) =>
        parseXml(xml).querySelector("item > guid")?.textContent;
      const bare = await feedXmlWithEnv("https://example.com", [
        row({ _id: "1", slug: "post" }),
      ]);
      const slashed = await feedXmlWithEnv("https://example.com/", [
        row({ _id: "1", slug: "post" }),
      ]);
      expect(guidOf(bare)).toBe("https://example.com/post");
      expect(guidOf(slashed)).toBe("https://example.com/post");
    });

    it("strips a run of trailing slashes, not just one (#289)", async () => {
      const xml = await feedXmlWithEnv("https://example.com///", [
        row({ _id: "1", slug: "post" }),
      ]);
      const doc = parseXml(xml);
      expect(doc.querySelector("item > link")?.textContent).toBe(
        "https://example.com/post",
      );
      expect(xml).not.toMatch(/example\.com\/\//);
    });

    it("an empty-string env still falls back to localhost, never an empty base (#289)", async () => {
      // `||` (not `??`) is what makes "" fall through — an empty base would emit
      // rootless links like `/post` and a self href of `/rss.xml`.
      const doc = parseXml(
        await feedXmlWithEnv("", [row({ _id: "1", slug: "post" })]),
      );
      expect(doc.querySelector("channel > link")?.textContent).toBe(
        "http://localhost:3000",
      );
      expect(doc.querySelector("item > link")?.textContent).toBe(
        "http://localhost:3000/post",
      );
    });

    it("trims surrounding whitespace before normalizing, so a stray space can't leak into URLs (#289)", async () => {
      // A dashboard copy-paste like `https://example.com/ ` would otherwise put a raw
      // space in every URL and defeat the trailing-slash strip.
      const doc = parseXml(
        await feedXmlWithEnv("https://example.com/ ", [
          row({ _id: "1", slug: "post" }),
        ]),
      );
      expect(doc.querySelector("item > link")?.textContent).toBe(
        "https://example.com/post",
      );
      expect(doc.querySelector("channel > link")?.textContent).toBe(
        "https://example.com",
      );
    });

    it("a title that is ENTIRELY illegal characters renders an empty title, not a broken document (#288)", async () => {
      const doc = parseXml(
        await feedXml([
          row({ _id: "1", slug: "hollow", title: "\x00\x01\uD800\uFFFE" }),
        ]),
      );
      expect(doc.querySelector("item > title")?.textContent).toBe("");
      expect(doc.querySelectorAll("item")).toHaveLength(1);
    });

    it("a lone surrogate at the very end of a summary is dropped and the feed still parses (#288)", async () => {
      const doc = parseXml(
        await feedXml([row({ _id: "1", slug: "tail", summary: "tail\uD83C" })]),
      );
      expect(doc.querySelector("item > description")?.textContent).toBe("tail");
    });
  });
});
