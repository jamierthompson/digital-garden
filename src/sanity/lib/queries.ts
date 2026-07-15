import { defineQuery } from "next-sanity";

/**
 * Entry feed query (RSS) — every published entry, any `kind`.
 *
 * The digital garden syndicates everything published — notes, essays, demos, AND `now`
 * updates — newest first by the authored `iterated` date (falling back to `_createdAt`). Pulls
 * only what an `<item>` renders — `summary` plus id / title / slug for the link, and `published`
 * (the same `coalesce(iterated, _createdAt)` the ordering uses, so each item's `<pubDate>` agrees
 * with feed order) — and deliberately NOT the `body`, keeping the read small. Its only reader is
 * `rss.xml/route.ts`. The over-fetch guard is asserted in queries.test.ts. Typed by Sanity TypeGen
 * as `ENTRY_FEED_QUERYResult`. `defineQuery` must wrap the literal — no runtime interpolation.
 */
export const ENTRY_FEED_QUERY = defineQuery(`
  *[_type == "entry" && defined(slug.current)] | order(coalesce(iterated, _createdAt) desc) {
    _id,
    title,
    "slug": slug.current,
    summary,
    "published": coalesce(iterated, _createdAt)
  }
`);

/**
 * All published entry slugs — any `kind`.
 *
 * Feeds `generateStaticParams` for the flat `/[slug]` route: every entry now has a
 * root-level detail page, so the build prerenders the whole published set (un-enumerated
 * slugs still render on-demand under PPR). Deliberately minimal — just the slug.
 */
export const ENTRY_SLUGS_QUERY = defineQuery(`
  *[_type == "entry" && defined(slug.current)]{ "slug": slug.current }
`);

/**
 * Entry-detail query (`/[slug]`, any `kind`).
 *
 * The full entry document for one slug — UNLIKE the index query, it DOES pull the `body`
 * (the detail route renders it through the Portable Text serializer) plus the entry's `theme`
 * object (`color`, `colorDark`, `headingFont`, `bodyFont`, `monoFont`) and the top-level `componentKey` that drive
 * `EntryScope` and module resolution, the facets (`kind`, `stage`, `iterated`, `featuredRank`), and the
 * surrounding `title` / `summary`. Backlinks resolve both directions: `related[]->`
 * is the outgoing edge; `backlinks` is the INCOMING edge (every entry that references this
 * one) via GROQ `references()`, so an edge authored once shows on both ends. `[0]` collapses
 * the filtered set to a single document (or `null` when the slug is unpublished/unknown) so
 * the route can `notFound()` on a miss.
 *
 * `$slug` is a GROQ parameter — the caller passes `{ slug }` to `.fetch`, never string
 * interpolation, so a hostile slug can't inject into the query. Typed by TypeGen as
 * `ENTRY_DETAIL_QUERYResult` in the root `sanity.types.ts`.
 *
 * `themeSeed` is the ONE seed the page themes from, resolved in the query so it lands
 * synchronously in the already-awaited result — no async boundary, so the static shell paints
 * flash-free (#166). It is KIND-gated, not presence-gated: a `now` entry ALWAYS wears the authored
 * `/now` page seed, so a now update wears the same theme as the `/now` index, and every themed kind
 * (note/essay/demo) wears its own required `theme.color`. The `forbiddenForNow` validator already
 * stops a `now` from carrying a `theme.color`; the kind-gate is the defense-in-depth behind it —
 * even a validator-bypassing value (a legacy doc, a raw API write) is IGNORED here rather than
 * sourced. A `select()` — not a `coalesce(theme.color, …)` — because coalesce is presence-gated and
 * would (a) source a now entry's own `theme.color` and (b) leave a `theme.color: ""` now entry
 * unthemed (coalesce only falls through on null, and `""` is reachable via the API). The route reads
 * `themeSeed` and never branches on `kind`.
 */
export const ENTRY_DETAIL_QUERY = defineQuery(`
  *[_type == "entry" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    kind,
    stage,
    iterated,
    featuredRank,
    summary,
    theme { color, colorDark, headingFont, bodyFont, monoFont },
    componentKey,
    "themeSeed": select(kind == "now" => *[_type == "siteSettings"][0].pageThemes.now, theme.color),
    body,
    related[]->{ _id, title, "slug": slug.current, kind },
    "backlinks": *[_type == "entry" && references(^._id)]{ _id, title, "slug": slug.current, kind }
  }
`);

/**
 * Index query (`/browse`, every kind) — the browsable list that folds the old `/work` and
 * `/notes` indexes into one editorial surface. (The Index route excludes `note`-kind entries
 * from its rendered sections; this query still returns them — the exclusion is a presentation
 * filter in the page, not a query change.)
 *
 * Pulls every published entry with the facets the Index reads — `kind` + `stage` (the group
 * headings + maturity badge) and a `linkCount` (outgoing `related` + incoming `references()`,
 * the backlink hint) — plus `title` / `slug` / `summary` for the row. Deliberately NOT the
 * `body` or the `theme` object: the Index wears the global editorial look (no per-row theme), so
 * it needs neither the rich text nor the entry's theme. Ordered by `kind`, then freshest
 * first (`iterated`, falling back to `_createdAt`). Typed as `INDEX_QUERYResult`.
 */
export const INDEX_QUERY = defineQuery(`
  *[_type == "entry" && defined(slug.current)] | order(kind asc, coalesce(iterated, _createdAt) desc) {
    _id,
    title,
    "slug": slug.current,
    kind,
    stage,
    iterated,
    summary,
    "linkCount": count(related) + count(*[_type == "entry" && references(^._id)])
  }
`);

/**
 * Featured query (`/`, curated front door) — entries with a `featuredRank`, any `kind`.
 *
 * The hurried evaluator's reading path: the curated subset an editor promoted (`featuredRank`
 * is set), ordered by rank (lower = earlier). Pulls the card fields — `summary` + the theme's
 * `color` — because the featured cards ARE themed: each re-binds its own engine-solved palette
 * inline via `cardSwatches`. Only `theme.color` is read (the card never wears the slot font).
 * Deliberately NOT the `body`, keeping the front-door payload small for LCP. Typed as
 * `FEATURED_QUERYResult`.
 */
export const FEATURED_QUERY = defineQuery(`
  *[_type == "entry" && defined(slug.current) && defined(featuredRank)] | order(featuredRank asc) {
    _id,
    title,
    "slug": slug.current,
    kind,
    stage,
    summary,
    theme { color }
  }
`);

/**
 * Now query (`/now`) — the dated "now" stream (`kind == "now"`).
 *
 * A reverse-chronological stream of `now` updates (à la nownownow.com), newest first by the
 * authored `iterated` date (falling back to `_createdAt`). Pulls `title` / `slug` / `summary`
 * for the stream entry and `iterated` for the date stamp — NOT the `body` (each update links
 * to its own flat `/[slug]` for the full text). Now-updates also fold into the Index's "Now"
 * section via `INDEX_QUERY`. Typed as `NOW_QUERYResult`.
 */
export const NOW_QUERY = defineQuery(`
  *[_type == "entry" && kind == "now" && defined(slug.current)] | order(coalesce(iterated, _createdAt) desc) {
    _id,
    title,
    "slug": slug.current,
    iterated,
    summary
  }
`);

/**
 * `siteSettings` singleton query.
 *
 * `siteSettings` is intended as a singleton (one document, enforced via Studio Structure
 * in a separate slice). `[0]` guards that intent at the query layer: it returns the single
 * settings document (or `null` if none is published) so the shell can fall back defensively
 * rather than assume an array. Pulls the shell identity — `title` / `description` for
 * `generateMetadata` (layout.tsx) — AND the per-page theme seeds: under the site-wide
 * engine-theming model (#166) the site-owned pages (`/`, `/browse`, `/about`, `/now`,
 * `/system`) have no backing `entry`, so they seed from `pageThemes` here. Each site page
 * consumes its seed (via `sitePageThemeSeed`) to theme the page. Typed as
 * `SITE_SETTINGS_QUERYResult`.
 */
export const SITE_SETTINGS_QUERY = defineQuery(`
  *[_type == "siteSettings"][0] {
    _id,
    title,
    description,
    pageThemes { home, browse, about, now, system }
  }
`);
