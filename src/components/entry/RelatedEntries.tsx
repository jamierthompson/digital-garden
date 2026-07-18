import Link from "next/link";

import EntryMeta from "@/components/entry/EntryMeta";
import Heading from "@/components/typography/Heading";
import { distinctNeighbors } from "@/lib/distinctNeighbors";

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
  /** Outgoing edges — `ENTRY_DETAIL_QUERY`'s `related[]->` projection. */
  related: (RelatedEntry | null)[] | null;
  /** Incoming edges — every entry that references this one, via GROQ `references()`. */
  backlinks: (RelatedEntry | null)[] | null;
}

/**
 * The entry's "Related" list — the union of its outgoing `related` edges and its incoming
 * `backlinks`, so an edge authored once shows on both ends. Renders **nothing** when there
 * are no connections, so the page shows no empty "Related" heading.
 *
 * The ragged graph shapes — a dangling reference (dereferenced to `null`), a self-reference,
 * a both-directions duplicate — wash out in `distinctNeighbors`, the same dedupe the detail
 * header's link count reads, so the two surfaces agree by construction.
 *
 * Titles link to the entry's flat detail route (`/<slug>`), each with its `kind` beside it
 * (the shared `EntryMeta` readout). An entry with no resolvable slug renders as plain text,
 * never a dead link.
 */
export default function RelatedEntries({
  currentId,
  related,
  backlinks,
}: RelatedEntriesProps) {
  // Cache Components keeps up to 3 route instances mounted at once (React's `<Activity>`,
  // hidden ones `display:none`) — visiting several `/[slug]` entries in one session can leave
  // multiple RelatedEntries trees live simultaneously, so a hardcoded id collides across them.
  // `useId()` looked like the fix but ISN'T: empirically, two Activity-preserved `/[slug]`
  // instances generated the identical id (Next's per-route Activity boundary resets React's
  // tree-id counter rather than forking it, so structurally-identical trees collide anyway).
  // `currentId` — the entry's own Sanity `_id` — is unique per rendered instance by
  // construction and doesn't depend on tree position, so it's used directly instead.
  const headingId = `related-heading-${currentId}`;

  const entries = distinctNeighbors(currentId, related, backlinks);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className={styles.related} aria-labelledby={headingId}>
      <Heading
        level={2}
        variant="label"
        id={headingId}
        className={styles.heading}
      >
        Related
      </Heading>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry._id} className={styles.item}>
            {/* The row is an inner wrapper so the `li` keeps its list marker (flex on the
                `li` itself would drop it). */}
            <div className={styles.row}>
              {entry.slug ? (
                <Link href={`/${entry.slug}`}>
                  {entry.title ?? "Untitled entry"}
                </Link>
              ) : (
                (entry.title ?? "Untitled entry")
              )}
              <EntryMeta kind={entry.kind} color="muted-foreground" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
