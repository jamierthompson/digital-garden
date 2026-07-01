import { defineQuery } from "next-sanity";

/**
 * Project feed query (RSS) — project-kind entries.
 *
 * Pulls only what the feed needs — `blurb`, plus the `kind` / `stage` / `featuredRank`
 * facets (and id / title / slug for the link) — and deliberately NOT the `body`, keeping the
 * read small. Filters to `kind == "project"`: the RSS feed is the portfolio's project stream.
 * (The old `/work` index this once fed folded into `/browse`; only `rss.xml` reads it now.)
 * The over-fetch guard is asserted in queries.test.ts. Typed by Sanity TypeGen as
 * `WORK_INDEX_QUERYResult`. `defineQuery` must wrap the literal — no runtime interpolation.
 */
export const WORK_INDEX_QUERY = defineQuery(`
  *[_type == "entry" && kind == "project" && defined(slug.current)] | order(_createdAt desc) {
    _id,
    title,
    "slug": slug.current,
    kind,
    stage,
    featuredRank,
    blurb,
    brandColor,
    fontKey
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
 * (the detail route renders it through the Portable Text serializer) plus the theming seeds
 * (`brandColor`, `brandColorDark`, `fontKey`, `componentKey`) that drive `ProjectScope` and
 * module resolution, the facets (`kind`, `stage`, `iterated`, `featuredRank`), and the
 * surrounding `title` / `blurb` / `tags`. Backlinks resolve both directions: `related[]->`
 * is the outgoing edge; `backlinks` is the INCOMING edge (every entry that references this
 * one) via GROQ `references()`, so an edge authored once shows on both ends. `[0]` collapses
 * the filtered set to a single document (or `null` when the slug is unpublished/unknown) so
 * the route can `notFound()` on a miss.
 *
 * `$slug` is a GROQ parameter — the caller passes `{ slug }` to `.fetch`, never string
 * interpolation, so a hostile slug can't inject into the query. Typed by TypeGen as
 * `PROJECT_DETAIL_QUERYResult` in the root `sanity.types.ts`.
 */
export const PROJECT_DETAIL_QUERY = defineQuery(`
  *[_type == "entry" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    kind,
    stage,
    iterated,
    featuredRank,
    blurb,
    brandColor,
    brandColorDark,
    fontKey,
    componentKey,
    body,
    related[]->{ _id, title, "slug": slug.current, kind },
    "backlinks": *[_type == "entry" && references(^._id)]{ _id, title, "slug": slug.current, kind },
    tags
  }
`);

/**
 * Index query (`/browse`, every kind) — the browsable list that folds the old `/work` and
 * `/notes` indexes into one editorial surface.
 *
 * Pulls every published entry with the facets the Index reads — `kind` + `stage` (the group
 * headings + maturity badge) and a `linkCount` (outgoing `related` + incoming `references()`,
 * the backlink hint) — plus `title` / `slug` / `blurb` for the row. Deliberately NOT the
 * `body` or theming seeds: the Index wears the global editorial look (no per-row brand), so it
 * needs neither the rich text nor `brandColor`/`fontKey`. Ordered by `kind`, then freshest
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
    blurb,
    "linkCount": count(related) + count(*[_type == "entry" && references(^._id)])
  }
`);

/**
 * `siteSettings` singleton query.
 *
 * `siteSettings` is intended as a singleton (one document, enforced via Studio Structure
 * in a separate slice). `[0]` guards that intent at the query layer: it returns the single
 * settings document (or `null` if none is published) so the shell can fall back defensively
 * rather than assume an array. Pulls the shell's brand seed + identity for `ProjectScope`
 * (slug="garden") and default metadata. Typed as `SITE_SETTINGS_QUERYResult`.
 */
export const SITE_SETTINGS_QUERY = defineQuery(`
  *[_type == "siteSettings"][0] {
    _id,
    title,
    description,
    brandColor,
    brandColorDark,
    fontKey
  }
`);
