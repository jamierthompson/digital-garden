import { createClient } from "next-sanity";
import { defineLive } from "next-sanity/live";

import { apiVersion, dataset, projectId } from "./env";
import { stegaFilter, studioUrl } from "./stega";

/**
 * The Sanity Live Content read path. [D16, D11]
 *
 * `defineLive` returns `{ sanityFetch, SanityLive }`: `sanityFetch` performs the
 * Content Lake read (published vs. drafts, the per-request token, and stega), and
 * `<SanityLive>` (mounted once in the root layout) opens the browser EventSource that
 * pushes content-change events so the page revalidates live. Our `./sanityFetch.ts`
 * wraps this `liveFetch` in `use cache` and maps Draft Mode → perspective/stega; routes
 * import THAT, never this directly.
 *
 * Which implementation runs: `next.config.ts` sets `cacheComponents: true`, which makes
 * Next add the `'next-js'` export condition, so `next-sanity/live` resolves to its
 * Cache-Components build — whose `sanityFetch` calls `cacheTag()` + `cacheLife()` and
 * reads NO request APIs itself. It expects the caller to resolve `draftMode()` outside
 * `use cache` and pass `perspective`/`stega` in, which is why we set `strict: true`.
 *
 * THE TAG CONTRACT (the Revalidate slice depends on this): every content read MUST carry
 * the coarse cache tags `sanity` and `sanity:<_type>` (e.g. `sanity:project`). Our
 * wrapper derives these from the query as `tags`; `defineLive` appends them to its
 * `cacheTag(...)` (alongside its own per-document syncTags). The publish webhook calls
 * `revalidateTag("sanity")` / `revalidateTag("sanity:<type>")` to flush published changes
 * into the static shell. Do NOT drop the coarse tags — the document-scoped syncTags are
 * NOT a substitute.
 */

/**
 * The base client handed to `defineLive`. `defineLive` re-derives `useCdn`,
 * `perspective`, `stega.enabled`, and the token per request, so the only config that
 * MUST live here is what it preserves and cannot infer: project coordinates and the
 * stega `studioUrl` + exclusion `filter`. `@sanity/client`'s `withConfig` MERGES
 * `stega` (it only overrides `enabled` for a boolean), so `defineLive`'s internal
 * `withConfig({ stega: false })` keeps our `studioUrl` + `filter` intact and a
 * per-fetch `stega: true` re-enables encoding with the [D16] exclusions still applied.
 * No token is baked in — `serverToken` below is attached per request, server-side only.
 */
const liveClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  stega: { studioUrl, filter: stegaFilter },
});

export const { sanityFetch: liveFetch, SanityLive } = defineLive({
  client: liveClient,
  // Server-only secret. Authorizes the drafts perspective + stega; `defineLive`
  // attaches it per request only when the perspective is non-published or stega is on,
  // never on the public CDN path. Read here in a server-only module, never bundled.
  // [security-and-ops §3]
  serverToken: process.env.SANITY_API_READ_TOKEN,
  // Browser-exposed (via the SanityLive EventSource) ONLY when live-previewing drafts
  // outside the Presentation Tool. Must be a dedicated minimal *Viewer*-scope token —
  // see .env.example. Optional: when unset, drafts still preview inside Presentation;
  // standalone browser live-draft just stays off (Path A — the shell never needs it).
  browserToken: process.env.SANITY_API_BROWSER_TOKEN,
  // Require `perspective`/`stega` at every fetch and `includeDrafts` on <SanityLive>.
  // Under Cache Components those depend on `draftMode()`, which must be resolved
  // outside `use cache`; strict makes "forgot to pass it" a compile error rather than
  // a silent published-only read. (DefineLiveOptions.strict, installed types.d.ts.)
  strict: true,
});
