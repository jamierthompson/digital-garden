// Build-time guard: this module holds the server-only token-selection logic, so it must
// never reach a client bundle. A stray `"use client"` import would fail the build here
// instead of silently shipping the draft-read path to the browser. (see security-and-ops.md)
import "server-only";

import { draftMode } from "next/headers";
import type { ClientReturn, QueryParams } from "next-sanity";

import { liveFetch } from "./live";

/**
 * The single read path for Sanity content in Server Components.
 *
 * A thin `use cache` adapter over `defineLive`'s fetcher (`liveFetch`, `./live.ts`),
 * so every route calls `sanityFetch(QUERY, params?)` and gets back the TypeGen'd result
 * directly — the "published vs. drafts" branch lives in exactly one place. Reads flow
 * through Sanity Live, so published changes revalidate live via `<SanityLive>` and the
 * publish webhook (tag contract in `./live.ts`), and drafts preview with stega-driven
 * click-to-edit.
 *
 * How the two paths resolve:
 * - Public request → Draft Mode OFF → `perspective: "published"`, `stega: false`. The
 *   read is CDN-backed and lands in the prerendered static shell (PPR), so the shell
 *   brand is flash-free in the initial bytes. `defineLive` sets a long
 *   `cacheLife` (on-demand tag revalidation is the freshness mechanism, not a timer).
 * - Draft Mode ON → `perspective: "drafts"`, `stega: true`. Next re-executes every
 *   cached function on every request and saves nothing (use-cache.md),
 *   so `liveFetch` serves fresh drafts with the server-only token attached by
 *   `defineLive`. No un-caching code needed here; the framework guarantees it.
 *
 * Why `draftMode()` is read *inside* the cache scope: it is the one Request API the
 * bundled docs permit inside `use cache` (unlike `cookies()`/`headers()`, which
 * throw). Reading it arms the native draft-bypass above AND lets us hand `liveFetch`
 * an explicit `perspective`/`stega` — required because under Cache Components
 * `defineLive`'s fetcher reads no request APIs itself (see `./live.ts`). We map
 * Draft Mode to the binary published/drafts perspective; the Presentation
 * preview-perspective cookie is intentionally not consulted here (reading `cookies()`
 * inside `use cache` is illegal, and Path A keeps the draft path binary).
 *
 * Typing mirrors `@sanity/client`'s `fetch`: the literal query `Q` resolves to its
 * TypeGen'd result via the `SanityQueries` augmentation in the root `sanity.types.ts`.
 * Pass the `defineQuery` literal, never an interpolated string, so that mapping holds.
 */
export async function sanityFetch<const Q extends string>(
  query: Q,
  params?: QueryParams,
): Promise<ClientReturn<Q>> {
  "use cache";

  const { isEnabled } = await draftMode();

  // Fail loud, not silent: draft mode without the server token would otherwise let
  // `defineLive` quietly fall back to published content, and the author would preview
  // stale data with no signal. Guard here so the published path never pays for it.
  // (see security-and-ops.md)
  if (isEnabled && !process.env.SANITY_API_READ_TOKEN) {
    throw new Error(
      "Draft mode is enabled but SANITY_API_READ_TOKEN is not set. " +
        "Set the server-only read token (see .env.example / security-and-ops.md).",
    );
  }

  const { data } = await liveFetch({
    query,
    params,
    perspective: isEnabled ? "drafts" : "published",
    stega: isEnabled,
    // THE TAG CONTRACT — coarse `sanity` + `sanity:<_type>` so the publish webhook
    // can revalidate published changes. See the contract note in `./live.ts`.
    tags: coarseTags(query),
  });

  return data as ClientReturn<Q>;
}

/** The bare tag every Sanity read carries — lets the webhook flush *all* content. */
const SANITY_TAG = "sanity";

/**
 * Derive the coarse cache tags for a query: always the bare `sanity` tag, plus a
 * `sanity:<_type>` for each document type the query filters on. Parsed from the GROQ
 * literal (`_type == "x"`) rather than threaded through every call site — that keeps
 * the read signature untouched (notably the layout's pinned `sanityFetch(SITE_SETTINGS
 * _QUERY)` call). Parsing is best-effort by design: the bare `sanity` tag guarantees
 * the webhook can always revalidate even if a query shape isn't recognised, and
 * `defineLive` adds precise per-document syncTags on top.
 */
export function coarseTags(query: string): string[] {
  const tags = new Set<string>([SANITY_TAG]);
  for (const [, type] of query.matchAll(/_type\s*==\s*["']([^"']+)["']/g)) {
    tags.add(`${SANITY_TAG}:${type}`);
  }
  return [...tags];
}
