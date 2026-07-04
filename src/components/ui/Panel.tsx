import type { CSSProperties, ReactNode } from "react";

import styles from "./Panel.module.css";

interface PanelProps {
  /** Accessible name — the section is a labelled landmark (role `region`). */
  readonly label: string;
  /**
   * Inline style pass-through — a host re-binds the semantic tokens the panel and its
   * children read (custom properties + `color-scheme`) for live downward theming.
   */
  readonly style?: CSSProperties;
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
  style,
  children,
}: PanelProps): React.ReactElement {
  return (
    <section aria-label={label} className={styles.panel} style={style}>
      {children}
    </section>
  );
}
