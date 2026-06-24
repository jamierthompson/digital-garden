import type { Metadata } from "next";
import { cacheLife } from "next/cache";

import { client } from "@/sanity/lib/client";

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

/**
 * Notes index. Lightweight by construction: shell + shared only, no project demo
 * bundles (those load only when an individual note explicitly embeds one). [§6]
 *
 * Cached with `use cache` because Cache Components is ON — uncached data outside
 * `<Suspense>` is a build-time hard error [D11]. Reads through the public `client`
 * (published, CDN, no token); cacheLife('hours') since notes change more often than
 * the shell brand but still prerender into the static shell.
 * (node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md)
 */
async function getNotes() {
  "use cache";
  cacheLife("hours");
  return client.fetch(NOTES_INDEX_QUERY);
}

export default async function NotesPage() {
  const notes = await getNotes();

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
