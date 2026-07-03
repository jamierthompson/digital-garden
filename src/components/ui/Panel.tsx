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
 * slot. Pair with `Note` for the italic aside voice inside a panel.
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
