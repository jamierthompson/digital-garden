"use client";

import { Tabs } from "radix-ui";

import styles from "./PillTabList.module.css";

/** One tab in the list. */
export interface PillTab {
  readonly id: string;
  readonly label: string;
}

interface PillTabListProps {
  /** Accessible name for the tab list. */
  readonly label: string;
  readonly tabs: readonly PillTab[];
}

/**
 * A pill-styled tab list (Radix `Tabs.List` + triggers) — the tab strip of a tabbed
 * surface. Generic UI primitive; the consumer owns `Tabs.Root` and `Tabs.Content`
 * (Radix wires the trigger↔panel relationship through the shared root), this owns the
 * pill look: hairline pills, active fills with the ambient accent.
 */
export default function PillTabList({
  label,
  tabs,
}: PillTabListProps): React.ReactElement {
  return (
    <Tabs.List className={styles.list} aria-label={label}>
      {tabs.map((tab) => (
        <Tabs.Trigger key={tab.id} className={styles.pill} value={tab.id}>
          {tab.label}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}
