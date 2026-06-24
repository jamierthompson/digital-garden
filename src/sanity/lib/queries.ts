import { defineQuery } from "next-sanity";

/**
 * `/work` index query. [§6]
 *
 * Pulls only what a card needs — `blurb`, `brandColor`, `fontKey` (plus id /
 * title / slug for the link) — and deliberately NOT the `essay`. This enforces
 * "a few colors per card" at the data layer: `brandColor` feeds `cardSwatches`
 * (engine Consumer C), and omitting the essay keeps the index payload small for
 * CWV. The over-fetch guard is asserted in queries.test.ts.
 *
 * Typed by Sanity TypeGen as `WORK_INDEX_QUERYResult` in the root
 * `sanity.types.ts`. `defineQuery` must wrap the literal — no runtime
 * interpolation — so TypeGen can statically pick it up.
 */
export const WORK_INDEX_QUERY = defineQuery(`
  *[_type == "project" && defined(slug.current)] | order(_createdAt desc) {
    _id,
    title,
    "slug": slug.current,
    blurb,
    brandColor,
    fontKey
  }
`);

/**
 * `/work/<slug>` project-detail query. [§6, D17]
 *
 * The full project document for one slug — UNLIKE the index query, it DOES pull the
 * `essay` (the detail route renders it through the Portable Text serializer) plus the
 * theming seeds (`brandColor`, `brandColorDark`, `fontKey`, `componentKey`) that drive
 * `ProjectScope` and module resolution, and the surrounding `title` / `blurb` / `notes` /
 * `tags`. `[0]` collapses the filtered set to a single document (or `null` when the slug
 * is unpublished/unknown) so the route can `notFound()` on a miss [D10, D19].
 *
 * `$slug` is a GROQ parameter — the caller passes `{ slug }` to `.fetch`, never string
 * interpolation, so a hostile slug can't inject into the query. Typed by TypeGen as
 * `PROJECT_DETAIL_QUERYResult` in the root `sanity.types.ts`.
 */
export const PROJECT_DETAIL_QUERY = defineQuery(`
  *[_type == "project" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    blurb,
    brandColor,
    brandColorDark,
    fontKey,
    componentKey,
    essay,
    notes[]->{ _id, title, "slug": slug.current },
    tags
  }
`);

/**
 * `siteSettings` singleton query. [§6]
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
