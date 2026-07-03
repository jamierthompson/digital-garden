import type { ReactNode } from "react";

import styles from "./Panel.module.css";

interface PanelProps {
  /** Accessible name — the section is a labelled landmark (role `region`). */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * A bordered surface panel — the framed card every interactive slot and demo board sits
 * in (the module-page "demo panel" treatment). Generic UI primitive: reads the ambient
 * semantic tokens, so it renders editorial by default and brand-tinted inside a project
 * slot. `PanelNote` is its companion caption voice — the italic aside beneath a panel's
 * content.
 */
export default function Panel({
  label,
  children,
}: PanelProps): React.ReactElement {
  return (
    <section aria-label={label} className={styles.panel}>
      {children}
    </section>
  );
}

/** The panel's italic aside — explanatory voice inside a panel, muted and short-measure. */
export function PanelNote({
  children,
}: {
  readonly children: ReactNode;
}): React.ReactElement {
  return <p className={styles.note}>{children}</p>;
}
