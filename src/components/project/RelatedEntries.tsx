import Link from "next/link";

import styles from "./RelatedEntries.module.css";

interface RelatedEntry {
  _id: string;
  title: string | null;
  slug: string | null;
  kind: string | null;
}

interface RelatedEntriesProps {
  /** The current entry's `_id`, so it is excluded from its own list (self-reference guard). */
  currentId: string;
  /** Outgoing edges — `PROJECT_DETAIL_QUERY`'s `related[]->` projection. */
  related: (RelatedEntry | null)[] | null;
  /** Incoming edges — every entry that references this one, via GROQ `references()`. */
  backlinks: (RelatedEntry | null)[] | null;
}

/**
 * The entry's "Related" list — the union of its outgoing `related` edges and its incoming
 * `backlinks`, so an edge authored once shows on both ends. Renders **nothing** when there
 * are no connections, so the page shows no empty "Related" heading.
 *
 * Defensive by design, covering the ways the graph can be ragged:
 * - a **dangling** reference (a `related` target since deleted) dereferences to `null` at
 *   runtime even though TypeGen types the elements non-null — so we filter nulls;
 * - a **self-reference** is dropped by `_id`;
 * - a **duplicate** (an entry that both references this one and is referenced back) is
 *   de-duped by `_id`.
 *
 * Titles link to the entry's flat detail route (`/<slug>`). An entry with no resolvable slug
 * renders as plain text, never a dead link.
 */
export default function RelatedEntries({
  currentId,
  related,
  backlinks,
}: RelatedEntriesProps) {
  const seen = new Set<string>([currentId]);
  const entries: RelatedEntry[] = [];
  for (const entry of [...(related ?? []), ...(backlinks ?? [])]) {
    if (!entry || seen.has(entry._id)) continue;
    seen.add(entry._id);
    entries.push(entry);
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className={styles.related} aria-labelledby="related-heading">
      <h2 id="related-heading" className={styles.heading}>
        Related
      </h2>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry._id} className={styles.item}>
            {entry.slug ? (
              <Link href={`/${entry.slug}`} className={styles.link}>
                {entry.title ?? "Untitled entry"}
              </Link>
            ) : (
              (entry.title ?? "Untitled entry")
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
