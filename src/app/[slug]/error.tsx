"use client";

import { useEffect } from "react";

import styles from "./states.module.css";

// The page-level error boundary for `/<slug>`. Error boundaries MUST be Client
// Components (`node_modules/.../03-file-conventions/error.md`). Next 16's props are `error`
// and `unstable_retry` (NOT the older `reset`) — verified against the bundled docs.
//
// This catches an unexpected throw from the PAGE'S OWN render (e.g. a Sanity fetch failure),
// NOT a throw from the route's layout/scope — a segment `error.tsx` cannot catch its own
// layout's throw, which is exactly why `ProjectScope` is wrapped in `unstable_catchError`
// instead. The defensive engine means the common theming path never reaches here.
export default function WorkError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Surface the error for observability; the digest correlates with server logs.
    console.error(error);
  }, [error]);

  return (
    <main className={styles.state} role="alert">
      <h1 className={styles.heading}>Something went wrong</h1>
      <p className={styles.body}>This project couldn’t be loaded right now.</p>
      <button
        type="button"
        className={styles.link}
        onClick={() => unstable_retry()}
      >
        Try again
      </button>
    </main>
  );
}
