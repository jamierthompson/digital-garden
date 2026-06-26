import { draftMode } from "next/headers";
import type { ClientReturn, QueryParams } from "next-sanity";

import { liveFetch } from "./live";

/**
 * The single read path for Sanity content in Server Components. [D11, D16]
 *
 * A thin `use cache` adapter over `defineLive`'s fetcher (`liveFetch`, `./live.ts`),
 * so every route keeps calling `sanityFetch(QUERY, params?)` and getting back the
 * TypeGen'd result directly — the "published vs. drafts" branch lives in exactly one
 * place. What changed under the hood: reads now flow through Sanity Live, so published
 * changes revalidate live via `<SanityLive>` and the publish webhook (tag contract in
 * `./live.ts`), and drafts preview with stega-driven click-to-edit.
 *
 * How the two paths resolve, same as before the migration:
 * - Public request → Draft Mode OFF → `perspective: "published"`, `stega: false`. The
 *   read is CDN-backed and lands in the prerendered static shell (PPR), so the shell
 *   brand is flash-free in the initial bytes [D11]. `defineLive` sets a long
 *   `cacheLife` (on-demand tag revalidation is the freshness mechanism, not a timer).
 * - Draft Mode ON → `perspective: "drafts"`, `stega: true`. Next re-executes every
 *   cached function on every request and saves nothing (use-cache.md §"Draft Mode"),
 *   so `liveFetch` serves fresh drafts with the server-only token attached by
 *   `defineLive`. No un-caching code needed here; the framework guarantees it.
 *
 * Why `draftMode()` is read *inside* the cache scope: it is the one Request API the
 * bundled docs permit inside `use cache` (unlike `cookies()`/`headers()`, which
 * throw). Reading it arms the native draft-bypass above AND lets us hand `liveFetch`
 * an explicit `perspective`/`stega` — required because under Cache Components
 * `defineLive`'s fetcher reads no request APIs itself (see `./live.ts`). We map
 * Draft Mode to the binary published/drafts perspective the repo has always used
 * [D16]; the Presentation preview-perspective cookie is intentionally not consulted
 * here (reading `cookies()` inside `use cache` is illegal, and Path A keeps the
 * draft path binary).
 *
 * NOTE on cache profiles: the old `cacheProfile` ("max"/"hours") arg is GONE.
 * `defineLive` owns cache lifetime and relies on on-demand tag revalidation, so a
 * shorter time-based window for notes is superseded — publishing a note now flushes
 * `sanity:note` immediately rather than waiting out a timer.
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
  // [security-and-ops §3]
  if (isEnabled && !process.env.SANITY_API_READ_TOKEN) {
    throw new Error(
      "Draft mode is enabled but SANITY_API_READ_TOKEN is not set. " +
        "Set the server-only read token (see .env.example / security-and-ops §3).",
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
 * `defineLive` adds precise per-document syncTags on top. Exported for direct testing.
 */
export function coarseTags(query: string): string[] {
  const tags = new Set<string>([SANITY_TAG]);
  for (const [, type] of query.matchAll(/_type\s*==\s*["']([^"']+)["']/g)) {
    tags.add(`${SANITY_TAG}:${type}`);
  }
  return [...tags];
}
