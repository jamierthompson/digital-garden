import Link from "next/link";

import styles from "./Wordmark.module.css";

/**
 * The `jamie thompson_` wordmark — the home link (`/`). The trailing `_` is a muted
 * blinking-cursor nod from the engineering-journal direction, decorative and hidden from AT.
 * The wordmark is unique chrome, not an inline text link — it owns its ink here rather than
 * wearing a `ui/TextLink` variant, and has no hover state.
 */
export default function Wordmark(): React.ReactElement {
  return (
    <Link href="/" className={styles.wordmark}>
      jamie thompson
      <span className={styles.cursor} aria-hidden="true">
        _
      </span>
    </Link>
  );
}
