import type { Metadata } from "next";

import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";
import { NOTES_INDEX_QUERY } from "./queries";

export const metadata: Metadata = {
  title: "Notes",
  description:
    "Working notes from the digital garden — short, linked, and growing by accretion.",
  openGraph: {
    title: "Notes",
    description:
      "Working notes from the digital garden — short, linked, and growing by accretion.",
    type: "website",
  },
};

export default async function NotesPage() {
  // Notes prerender into the static shell and serve fresh drafts under Draft Mode.
  // `defineLive` owns cache lifetime and the publish webhook flushes `sanity:note` on
  // publish, so no time-based revalidate window is needed.
  const notes = await sanityFetch(NOTES_INDEX_QUERY);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Notes</h1>
        <p className={styles.intro}>
          Short working notes, linked together. The garden grows by accretion.
        </p>
      </header>
      {notes.length === 0 ? (
        <p className={styles.empty}>
          No notes have sprouted yet — check back soon.
        </p>
      ) : (
        <ul className={styles.list}>
          {notes.map((note) => (
            <li key={note._id} className={styles.item}>
              <span className={styles.noteTitle}>{note.title}</span>
              {note.relatedCount && note.relatedCount > 0 ? (
                <span className={styles.meta}>{note.relatedCount} linked</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
