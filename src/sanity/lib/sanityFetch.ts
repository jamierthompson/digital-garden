import { cacheLife } from "next/cache";
import { draftMode } from "next/headers";
import type { ClientReturn, QueryParams } from "next-sanity";

import { getClient } from "./getClient";

/**
 * The single read path for Sanity content in Server Components. [D11, D16]
 *
 * One helper so the "published vs. draft" branch lives in exactly one place instead
 * of being re-derived at every route. It is `use cache` *and* draft-aware at the same
 * time, which Next 16's Cache Components supports natively:
 *
 * - For a normal public request, Draft Mode is OFF, so this reads through the public,
 *   CDN-backed, published-only `client` and the result lands in the prerendered static
 *   shell (PPR) under the given `cacheLife` profile.
 * - When Draft Mode is ON (the `__prerender_bypass` cookie is set by the draft-mode
 *   route handlers), `draftMode().isEnabled` is `true`. Next then **re-executes every
 *   cached function on every request and saves nothing to the cache**, so `getClient(true)`
 *   — the uncached, drafts-perspective, stega-on client with the server-only read token —
 *   serves fresh draft content for Preview. No special un-caching code is needed on our
 *   side; the framework guarantees it.
 *   (node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md
 *   §"Draft Mode"; …/04-functions/draft-mode.md.)
 *
 * Why `draftMode()` is read *inside* the cache scope (not hoisted out): it is the one
 * runtime API the bundled docs explicitly permit inside `use cache` — unlike
 * `cookies()`/`headers()`, which throw. Reading it here is what arms the native
 * draft-bypass above. The token itself is read inside `getClient` from the server-only
 * environment, never a module-level constant that could reach a client bundle.
 * [security-and-ops §3]
 *
 * Typing mirrors `@sanity/client`'s `fetch`: the literal query string `Q` resolves to its
 * TypeGen'd result via the `SanityQueries` module augmentation in the root
 * `sanity.types.ts`, so callers keep the exact same typed results they had when calling
 * `client.fetch(QUERY)` directly. Pass the `defineQuery` literal, never an interpolated
 * string, so that mapping (and TypeGen) holds.
 */

/**
 * The two built-in `cacheLife` profiles the routes actually use — `max` for stable,
 * tag/deploy-revalidated content (projects, shell brand) and `hours` for notes, which
 * change more often. Only these two are listed (not the full roster) per the repo's
 * don't-build-until-forced discipline; widen the union when a third profile is needed.
 */
type CacheProfile = "max" | "hours";

export async function sanityFetch<const Q extends string>(
  query: Q,
  params?: QueryParams,
  cacheProfile: CacheProfile = "max",
): Promise<ClientReturn<Q>> {
  "use cache";
  // `cacheLife`'s parameter is a profile-name union, not a bare `string`, so it only
  // accepts a *literal* — a variable (even one narrowed to these two values) doesn't
  // satisfy it. Branch to a literal call; the `CacheProfile` union keeps this exhaustive.
  if (cacheProfile === "hours") {
    cacheLife("hours");
  } else {
    cacheLife("max");
  }

  const { isEnabled } = await draftMode();
  return getClient(isEnabled).fetch(query, params);
}
