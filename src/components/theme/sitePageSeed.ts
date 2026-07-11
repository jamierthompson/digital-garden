// Server-only: reads Sanity through `sanityFetch`, so a stray client import fails the build
// here rather than shipping the read path to the browser (mirrors `sanityFetch`'s own guard).
import "server-only";

import { SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

/**
 * The site-owned pages that seed their theme from the `siteSettings` singleton — the routes
 * with no backing `entry` (`/`, `/browse`, `/about`, `/now`, `/system`). Keyed by the field
 * name under `pageThemes`; `keyof` the generated result type so a renamed/added seed field is a
 * compile error here, not a silent miss.
 */
export type SitePageKey = keyof NonNullable<
  NonNullable<
    Awaited<ReturnType<typeof sanityFetch<typeof SITE_SETTINGS_QUERY>>>
  >["pageThemes"]
>;

/**
 * Resolve a site-owned page's authored theme seed from `siteSettings.pageThemes`.
 *
 * Returns the raw authored theme-color string (or `null` when unauthored / no settings doc) —
 * `PageTheme` resolves it defensively, collapsing null/blank/unparseable to the safe fallback
 * palette, so a page never has to branch on a missing seed.
 *
 * Reads through the `use cache` `sanityFetch`, so the value lands in the page's PRERENDERED
 * static shell (the inline theme script bakes into the initial HTML → flash-free), and the read
 * dedupes with the layout's own `SITE_SETTINGS_QUERY` fetch. Call this on the page's own
 * synchronously-awaited path and feed the result to a synchronous `<PageTheme seed>` so the
 * script never lands inside a streamed/`Suspense` hole (the #172 streamed-shell rule).
 */
export async function sitePageThemeSeed(
  page: SitePageKey,
): Promise<string | null> {
  const settings = await sanityFetch(SITE_SETTINGS_QUERY);
  return settings?.pageThemes?.[page] ?? null;
}
