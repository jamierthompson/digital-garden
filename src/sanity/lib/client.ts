import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "./env";

/**
 * The PUBLIC client — published content only, fully cacheable, no token.
 *
 * `useCdn: true` serves from Sanity's CDN (published docs, no token). Stega is
 * `enabled: false`: this client never carries a token and never powers Visual
 * Editing, so it must emit clean strings.
 *
 * It is the read path for surfaces that are published-only by definition and must
 * NOT participate in Live/draft preview:
 * - `generateStaticParams` (build-time enumeration — Draft Mode has no meaning),
 * - the RSS feed (`/rss.xml` is public — drafts must never leak there),
 * - the Draft Mode *enable* handshake (`.withConfig({ token })` authorizes the
 *   preview validation only; the draft READS go through the Live fetcher).
 *
 * Live/draft content reads go through `sanityFetch` (`./sanityFetch.ts`), which is
 * backed by `defineLive` (`./live.ts`) — that owns the published-vs-drafts branch,
 * the per-request token, and stega. (see security-and-ops.md)
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
  stega: { enabled: false },
});
