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
      return `    <item>
      <title>${title}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
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
