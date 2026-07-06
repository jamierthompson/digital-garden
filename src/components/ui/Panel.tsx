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
  /**
   * Visual treatment. `framed` (default) is the bordered surface card. `plain` drops ALL
   * chrome (surface, border, radius, padding) so a group of self-chromed cards sits directly on
   * the themed ground (the page `--bg`) instead of on an island — the section, its `region` label, and the `style` token
   * binding are UNCHANGED, so scoped-token resolution and a11y hold either way.
   */
  readonly variant?: "framed" | "plain";
  readonly children: ReactNode;
}

/**
 * A surface panel — the labelled `region` every interactive slot and demo board sits in.
 * Generic UI primitive: reads the ambient semantic tokens, so it renders editorial by default
 * and brand-tinted inside a project slot. `framed` gives it the bordered demo-panel surface;
 * `plain` is chrome-free (for a grid of already-carded content). Pair with `Aside` for the
 * italic aside voice inside a panel.
 */
export default function Panel({
  label,
  style,
  variant = "framed",
  children,
}: PanelProps): React.ReactElement {
  const className =
    variant === "plain" ? styles.panel : `${styles.panel} ${styles.framed}`;
  return (
    <section aria-label={label} className={className} style={style}>
      {children}
    </section>
  );
}
