import { createClient } from "next-sanity";
import { defineLive } from "next-sanity/live";

import { apiVersion, dataset, projectId } from "./env";
import { stegaFilter, studioUrl } from "./stega";

/**
 * The Sanity Live Content read path. [D16, D11]
 *
 * `defineLive` (next-sanity v13) is the Cache-Components-aware successor to the old
 * hand-rolled `getClient(isEnabled).fetch`. It returns `{ sanityFetch, SanityLive }`:
 * `sanityFetch` performs the actual Content Lake read (resolving published vs. drafts,
 * the per-request token, and stega), and `<SanityLive>` (mounted once in the root
 * layout) opens the browser EventSource that pushes content-change events so the page
 * revalidates live. Our own `./sanityFetch.ts` wraps this `liveFetch` in `use cache`
 * and maps Draft Mode → perspective/stega; routes import THAT, never this directly.
 *
 * ── Which implementation runs ────────────────────────────────────────────────────
 * `next.config.ts` sets `cacheComponents: true`, which makes Next add the `'next-js'`
 * export condition (node_modules/next/dist/build/webpack-config.js — `conditionNames:
 * [config.cacheComponents ? 'next-js' : '', '...']`). So `next-sanity/live` resolves
 * to its Cache-Components build, whose `sanityFetch` calls `cacheTag()` + `cacheLife()`
 * and reads NO request APIs itself — it expects the caller to resolve `draftMode()`
 * OUTSIDE/at the edge of `use cache` and pass `perspective`/`stega` in. That is exactly
 * what our wrapper does, which is why we set `strict: true` below.
 *
 * ── THE TAG CONTRACT (the Revalidate slice depends on this) ──────────────────────
 * Every content read MUST carry the coarse cache tags **`sanity`** and
 * **`sanity:<_type>`** (e.g. `sanity:project`, `sanity:siteSettings`, `sanity:note`).
 * Our wrapper derives these from the query and passes them as `tags`; `defineLive`
 * appends them to its `cacheTag(...)` call (alongside its own per-document
 * `sanity:<syncTag>` tags from Content Lake). The publish-to-prod webhook
 * (Revalidate slice) calls `revalidateTag("sanity")` / `revalidateTag("sanity:<type>")`
 * to flush published changes into the static shell. Do NOT drop the coarse tags — the
 * automatic syncTags are document-scoped and are NOT a substitute for the contract.
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
