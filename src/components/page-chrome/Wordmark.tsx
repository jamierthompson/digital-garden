import Link from "next/link";

import styles from "./Wordmark.module.css";

/**
 * The `folio_` wordmark — the home link (`/`). The trailing `_` is a muted blinking-cursor
 * nod from the engineering-journal direction, decorative and hidden from AT.
 */
export default function Wordmark(): React.ReactElement {
  return (
    <Link href="/" className={styles.wordmark}>
      folio
      <span className={styles.cursor} aria-hidden="true">
        _
      </span>
    </Link>
  );
}
