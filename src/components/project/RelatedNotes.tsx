import styles from "./RelatedNotes.module.css";

interface RelatedNote {
  _id: string;
  title: string | null;
}

interface RelatedNotesProps {
  /** The project's related notes, from `PROJECT_DETAIL_QUERY`'s `notes[]->` projection. */
  notes: RelatedNote[] | null;
}

/**
 * The project's "Related notes" list.
 *
 * A pure, synchronous, var-consuming component that renders **nothing** when
 * there are no related notes, so the page shows no empty "Related" heading.
 *
 * Titles render as plain text, not links: there is no `/notes/<slug>` route, so a link
 * would dead-end. Untitled notes fall back to a neutral label rather than an empty `<li>`.
 */
export default function RelatedNotes({ notes }: RelatedNotesProps) {
  if (!notes || notes.length === 0) {
    return null;
  }

  return (
    <section className={styles.related} aria-labelledby="related-notes-heading">
      <h2 id="related-notes-heading" className={styles.heading}>
        Related notes
      </h2>
      <ul className={styles.list}>
        {notes.map((note) => (
          <li key={note._id} className={styles.item}>
            {note.title ?? "Untitled note"}
          </li>
        ))}
      </ul>
    </section>
  );
}
