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
 * flash-free (#166). Two rungs:
 *
 * The entry's own rung is KIND-gated, not presence-gated: a `now` entry ALWAYS wears the authored
 * `/now` page seed (never a color of its own), and a themed kind (note/essay/demo) wears its own
 * `theme.color`. The `forbiddenForNow` validator already stops a `now` from carrying a
 * `theme.color`; the kind-gate is the defense-in-depth behind it — even a validator-bypassing
 * value (a legacy doc, a raw API write) is IGNORED here rather than sourced. A `select()` — not a
 * `coalesce(theme.color, …)` — because coalesce is presence-gated and would (a) source a now
 * entry's own `theme.color` and (b) leave a `theme.color: ""` now entry unthemed (coalesce only
 * falls through on null, and `""` is reachable via the API).
 *
 * The outer `coalesce(…, siteSettings.theme.color)` is the site default rung (#253): an entry
 * that authors no seed — and a `now` when no `/now` override is authored — wears the authored
 * site default. The coalesce IS presence-gated, deliberately: a reachable-via-API `""` at the
 * inner rung resolves to `""`, which `PageTheme` collapses to the engine fallback rather than
 * silently re-routing to a different authored seed. The route reads `themeSeed` and never
 * branches on `kind`.
 *
 * `body` spreads every block through unchanged EXCEPT `figure`, which expands its image
 * `asset->` to the fields the render pipeline needs: `metadata.dimensions` reserves the
 * image's box before paint (no layout shift) and `metadata.lqip` feeds the blur-up
 * placeholder. The block's own `crop`/`hotspot` ride along in the spread — they live on the
 * block, not the asset document.
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
    "themeSeed": coalesce(
      select(kind == "now" => *[_type == "siteSettings"][0].pageThemes.now, theme.color),
      *[_type == "siteSettings"][0].theme.color
    ),
    body[] {
      ...,
      _type == "figure" => {
        ...,
        asset->{ _id, metadata { lqip, dimensions } }
      }
    },
    related[]->{ _id, title, "slug": slug.current, kind },
    "backlinks": *[_type == "entry" && references(^._id)]{ _id, title, "slug": slug.current, kind }
  }
`);

/**
 * Index query (`/browse`) — the browsable list that folds the old `/work` and `/notes` indexes
 * into one editorial surface.
 *
 * Excludes `now` at the QUERY, not in the page: the dated stream is `/now`'s surface, served by
 * `NOW_QUERY`, and this query's only reader is `/browse`. Filtering here keeps the query's
 * contract identical to the surface it feeds and stops the Index fetching rows it would only
 * throw away. The page's own kind allowlist still stands behind it — that guards against
 * drifted data (a kind authored before its code ships), which is a different job.
 *
 * Pulls every other published entry with the facets the Index reads — `kind` (the group
 * headings), the row's meta readout (`stage` + `iterated`), and a `linkCount` (distinct
 * neighbors across outgoing `related` and incoming `references()`, the backlink hint) — plus
 * `title` / `slug` / `summary` for the row. Deliberately NOT the `body` or the `theme` object:
 * the Index wears the global editorial look (no per-row theme), so it needs neither the rich
 * text nor the entry's theme. Ordered by `kind`, then freshest first (`iterated`, falling back
 * to `_createdAt`). Typed as `INDEX_QUERYResult`.
 *
 * `linkCount` counts DISTINCT neighbors, never a sum of the two directions: they overlap (an
 * edge authored both ways is one neighbor), so the ids are unioned with `array::unique`, a
 * self-reference is dropped (`@ != ^._id`), and a dangling reference — which dereferences to
 * `null` — is filtered out (`defined(@)`) rather than counted as a neighbor the reader can't
 * reach. The `coalesce(..., [])` is load-bearing: GROQ evaluates a traversal of an ABSENT field
 * to `null`, and `null + [...]` is `null`. Without it, an entry that authored no `related` array
 * — the Studio writes no empty array, so this is the common shape — reports a null count and
 * silently loses its hint.
 */
export const INDEX_QUERY = defineQuery(`
  *[_type == "entry" && defined(slug.current) && kind != "now"] | order(kind asc, coalesce(iterated, _createdAt) desc) {
    _id,
    title,
    "slug": slug.current,
    kind,
    stage,
    iterated,
    summary,
    "linkCount": count(array::unique(
      coalesce(related[]->_id, []) + *[_type == "entry" && references(^._id)]._id
    )[defined(@) && @ != ^._id])
  }
`);

/**
 * Featured query (`/`, curated front door) — entries with a `featuredRank`, any `kind`.
 *
 * The hurried evaluator's reading path: the curated subset an editor promoted (`featuredRank`
 * is set), ordered by rank (lower = earlier). Pulls the card fields — `summary` and the mono
 * readout's facts (`kind` / `stage` / `iterated` / `linkCount`). Deliberately NOT the `body`,
 * and NOT a per-entry theme seed — one seed paints a page, so the cards read the homepage's
 * own theme from the ambient semantic tokens — keeping the front-door payload small for LCP.
 * Typed as `FEATURED_QUERYResult`.
 *
 * `linkCount` counts DISTINCT neighbors, never a sum of the two directions: they overlap (an
 * edge authored both ways is one neighbor), so the ids are unioned with `array::unique`, a
 * self-reference is dropped (`@ != ^._id`), and a dangling reference — which dereferences to
 * `null` — is filtered out (`defined(@)`) rather than counted as a neighbor the reader can't
 * reach. The `coalesce(..., [])` is load-bearing: GROQ evaluates a traversal of an ABSENT field
 * to `null`, and `null + [...]` is `null`. Without it, an entry that authored no `related` array
 * — the Studio writes no empty array, so this is the common shape — reports a null count and
 * silently loses its hint.
 */
export const FEATURED_QUERY = defineQuery(`
  *[_type == "entry" && defined(slug.current) && defined(featuredRank)] | order(featuredRank asc) {
    _id,
    title,
    "slug": slug.current,
    kind,
    stage,
    iterated,
    summary,
    "linkCount": count(array::unique(
      coalesce(related[]->_id, []) + *[_type == "entry" && references(^._id)]._id
    )[defined(@) && @ != ^._id])
  }
`);

/**
 * Now query (`/now`) — the dated "now" stream (`kind == "now"`).
 *
 * A reverse-chronological stream of `now` updates (à la nownownow.com), newest first by the
 * authored `iterated` date (falling back to `_createdAt`). Pulls `title` / `slug` / `summary`
 * for the stream entry, `iterated` for the date stamp, and `linkCount` (the backlink hint) —
 * NOT the `body` (each update links to its own flat `/[slug]` for the full text). `/now` is
 * the only surface that lists these: `INDEX_QUERY` filters `now` out. Typed as
 * `NOW_QUERYResult`.
 *
 * `linkCount` counts DISTINCT neighbors, never a sum of the two directions: they overlap (an
 * edge authored both ways is one neighbor), so the ids are unioned with `array::unique`, a
 * self-reference is dropped (`@ != ^._id`), and a dangling reference — which dereferences to
 * `null` — is filtered out (`defined(@)`) rather than counted as a neighbor the reader can't
 * reach. The `coalesce(..., [])` is load-bearing: GROQ evaluates a traversal of an ABSENT field
 * to `null`, and `null + [...]` is `null`. Without it, an entry that authored no `related` array
 * — the Studio writes no empty array, so this is the common shape — reports a null count and
 * silently loses its hint.
 */
export const NOW_QUERY = defineQuery(`
  *[_type == "entry" && kind == "now" && defined(slug.current)] | order(coalesce(iterated, _createdAt) desc) {
    _id,
    title,
    "slug": slug.current,
    iterated,
    summary,
    "linkCount": count(array::unique(
      coalesce(related[]->_id, []) + *[_type == "entry" && references(^._id)]._id
    )[defined(@) && @ != ^._id])
  }
`);

/**
 * `siteSettings` singleton query.
 *
 * `siteSettings` is intended as a singleton (one document, enforced via Studio Structure
 * in a separate slice). `[0]` guards that intent at the query layer: it returns the single
 * settings document (or `null` if none is published) so the shell can fall back defensively
 * rather than assume an array. Pulls the shell identity — `title` / `description` for
 * `generateMetadata` (layout.tsx) — AND the theming seeds: the site default `theme`
 * (`color` + optional `colorDark` dark override, #253) that every resolution chain falls back
 * to, and the per-page overrides: under the site-wide engine-theming model (#166) the
 * site-owned pages (`/`, `/browse`, `/about`, `/now`, `/system`) have no backing `entry`, so
 * they seed from `pageThemes` here, defaulting to `theme.color`. Each site page consumes its
 * seed (via `sitePageThemeSeed`) to theme the page. Typed as `SITE_SETTINGS_QUERYResult`.
 */
export const SITE_SETTINGS_QUERY = defineQuery(`
  *[_type == "siteSettings"][0] {
    _id,
    title,
    description,
    theme { color, colorDark },
    pageThemes { home, browse, about, now, system }
  }
`);
