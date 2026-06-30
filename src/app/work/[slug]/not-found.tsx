import Link from "next/link";

import styles from "./states.module.css";

// The not-found boundary for `/work/<slug>`. Rendered when the route calls
// `notFound()` — an unpublished/unknown slug, or a `componentKey` that no longer resolves
// in code. This is the CORRECT containment for a content→code key miss: a visible,
// navigable fallback, never a crash. (The scope/layout THROW is a different failure, already
// contained by the defensive engine + `unstable_catchError` backstop, NOT by this file.)
export default function WorkNotFound() {
  return (
    <main className={styles.state}>
      <h1 className={styles.heading}>Project not found</h1>
      <p className={styles.body}>
        That project doesn’t exist, or its module is no longer available.
      </p>
      <Link href="/work" className={styles.link}>
        Back to all work
      </Link>
    </main>
  );
}
