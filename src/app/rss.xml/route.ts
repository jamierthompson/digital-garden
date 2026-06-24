import { cacheLife } from "next/cache";

import { client } from "@/sanity/lib/client";
import { WORK_INDEX_QUERY } from "@/sanity/lib/queries";

import { escapeXml } from "./escapeXml";

/**
 * RSS 2.0 feed of portfolio projects, served at `/rss.xml`.
 *
 * A Route Handler that returns non-UI content — the bundled docs put RSS at
 * exactly this path (`app/rss.xml/route.ts`,
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
 * §Non-UI Responses). It reuses the existing published-only `WORK_INDEX_QUERY`
 * via the PUBLIC client — RSS is public content, so drafts must never leak here.
 *
 * Cache Components is on app-wide [D11], so this is dynamic by default. The feed
 * changes only when projects are published, so the data read is wrapped in a
 * `use cache` function with `cacheLife("hours")` — efficient without serving stale
 * feeds for long.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Cached read of the published project index. `use cache` + `cacheLife` keep the
 * feed off the per-request path; the public client returns the TypeGen-typed
 * `WORK_INDEX_QUERY_RESULT` (no token, published perspective).
 */
async function getFeedProjects() {
  "use cache";
  cacheLife("hours");
  return client.fetch(WORK_INDEX_QUERY);
}

export async function GET() {
  const projects = await getFeedProjects();

  const items = projects
    // A project with no slug has no canonical URL — skip it rather than emit a
    // broken `<link>`. (`WORK_INDEX_QUERY` already filters on `defined(slug.current)`,
    // but the typed result is nullable, so guard explicitly.)
    .filter((project) => project.slug)
    .map((project) => {
      const url = `${SITE_URL}/work/${project.slug}`;
      const title = escapeXml(project.title ?? "Untitled");
      const description = project.blurb ? escapeXml(project.blurb) : "";
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
    <title>Digital Garden — Work</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Projects from the digital garden.</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      // The registered RSS media type; `charset` documents the declared encoding.
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
