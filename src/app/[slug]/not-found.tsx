import Link from "next/link";

import styles from "./states.module.css";

// The not-found boundary for `/<slug>`. Rendered when the route calls `notFound()` — an
// unpublished/unknown slug, or (for a project) a `componentKey` that no longer resolves in
// code. This is the CORRECT containment for a content→code key miss: a visible, navigable
// fallback, never a crash. (The scope/layout THROW is a different failure, already contained
// by the defensive engine + `unstable_catchError` backstop, NOT by this file.)
export default function EntryNotFound() {
  return (
    <main className={styles.state}>
      <h1 className={styles.heading}>Not found</h1>
      <p className={styles.body}>
        That page doesn’t exist, or its content is no longer available.
      </p>
      <Link href="/" className={styles.link}>
        Back to home
      </Link>
    </main>
  );
}
