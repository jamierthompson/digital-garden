import { MAIN_CONTENT_ID } from "@/lib/landmarks";

import styles from "./SkipLink.module.css";

/**
 * The skip-to-content link — the first focusable in the document, letting a keyboard user jump the
 * shell nav straight to the page's `<main>` (WCAG 2.4.1 Bypass Blocks). Off-screen until focused,
 * then a visible chip. Targets the `MAIN_CONTENT_ID` landmark every view's `<main>` carries.
 */
export default function SkipLink(): React.ReactElement {
  return (
    <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
      Skip to content
    </a>
  );
}
