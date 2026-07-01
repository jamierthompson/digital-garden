import { defineQuery } from "next-sanity";

/**
 * Notes index query (shell-owned).
 *
 * Pulls only what the lightweight notes list needs — `title`, `slug`, and a
 * `relatedCount` for a backlink hint — deliberately NOT the `body`. Notes stay
 * lightweight (shell + shared only); a note pulls a project demo bundle only when
 * it explicitly embeds one, so the index never needs the rich-text surface.
 *
 * `defineQuery` wraps the literal (no runtime interpolation) so Sanity TypeGen can
 * statically type it as `NOTES_INDEX_QUERY_RESULT` in the root `sanity.types.ts`.
 */
export const NOTES_INDEX_QUERY = defineQuery(`
  *[_type == "entry" && kind == "note" && defined(slug.current)] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    "relatedCount": count(related)
  }
`);
