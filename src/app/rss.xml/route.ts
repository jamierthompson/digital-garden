import { cacheLife } from "next/cache";

import { client } from "@/sanity/lib/client";
import { ENTRY_FEED_QUERY } from "@/sanity/lib/queries";

import { escapeXml } from "./escapeXml";

/**
 * RSS 2.0 feed of the digital garden, served at `/rss.xml`.
 *
 * A Route Handler that returns non-UI content — the bundled docs put RSS at
 * exactly this path (`app/rss.xml/route.ts`,
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md). It reads the published-only `ENTRY_FEED_QUERY`
 * (every kind) via the PUBLIC client — RSS is public content, so drafts must never leak here.
 *
 * Cache Components is on app-wide, so this is dynamic by default. The feed
 * changes only when entries are published, so the data read is wrapped in a
 * `use cache` function with `cacheLife("hours")` — efficient without serving stale
 * feeds for long.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Cached read of the published entry feed — public client (no token, published perspective) so drafts never leak into the feed. */
async function getFeedEntries() {
  "use cache";
  cacheLife("hours");
  return client.fetch(ENTRY_FEED_QUERY);
}

/**
 * RSS 2.0 dates are RFC-822 (the RFC-1123 four-digit-year form readers expect); `toUTCString()`
 * emits exactly that. Returns `null` for a missing or unparseable value so a dateless item omits
 * `<pubDate>` rather than emitting a bare or `"Invalid Date"` element. (`published` is
 * `coalesce(iterated, _createdAt)`, so in practice it is always a valid `_createdAt` — the guard
 * covers the nullable type and any hostile out-of-band write.)
 */
function toRfc822(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

export async function GET() {
  const entries = await getFeedEntries();

  const items = entries
    // An entry with no slug has no canonical URL — skip it rather than emit a
    // broken `<link>`. (`ENTRY_FEED_QUERY` already filters on `defined(slug.current)`,
    // but the typed result is nullable, so guard explicitly.)
    .filter((entry) => entry.slug)
    .map((entry) => {
      const url = `${SITE_URL}/${entry.slug}`;
      const title = escapeXml(entry.title ?? "Untitled");
      const description = entry.blurb ? escapeXml(entry.blurb) : "";
      // `toRfc822` output is a fixed-format ASCII date (no XML metacharacters), so it needs no
      // escaping; a dateless item drops the element entirely rather than emitting an empty one.
      const pubDate = toRfc822(entry.published);
      return `    <item>
      <title>${title}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ""}
      <description>${description}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Jamie Thompson — Digital Garden</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Notes, essays, projects, and now-updates from the digital garden.</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
