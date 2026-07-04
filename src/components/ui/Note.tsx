import type { ReactNode } from "react";

import styles from "./Note.module.css";

/**
 * The serif-italic aside — the site's explanatory voice: a short, muted, italic line
 * beneath a control or panel (a rule's plain-English consequence, a panel's caption).
 * Generic UI primitive: reads the ambient semantic tokens.
 */
export default function Note({
  children,
}: {
  readonly children: ReactNode;
}): React.ReactElement {
  return <p className={styles.note}>{children}</p>;
}
