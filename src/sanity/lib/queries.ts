import { defineQuery } from "next-sanity";

/**
 * `/work` index query. [§6]
 *
 * Pulls only what a card needs — `blurb`, `brandColor`, `fontKey` (plus id /
 * title / slug for the link) — and deliberately NOT the `essay`. This enforces
 * "a few colours per card" at the data layer: `brandColor` feeds `cardSwatches`
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
