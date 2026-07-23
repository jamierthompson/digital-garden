import type { ReactNode } from "react";

import EntryMeta from "@/components/entry/EntryMeta";
import EntryTeaser from "@/components/entry/EntryTeaser";
import HoverPrefetchLink from "@/components/ui/HoverPrefetchLink";

import styles from "./EntryCard.module.css";

/** The entry fields a card renders — a structural subset of the query rows, so any entry
 *  query (featured, index, …) with these fields can feed the card. */
export interface EntryCardEntry {
  title: string | null;
  slug: string | null;
  summary: string | null;
  kind: string | null;
  stage: "budding" | "evergreen" | "seedling" | null;
  /** The authored last-tended date (ISO `YYYY-MM-DD`), for the meta readout. */
  tended: string | null;
  /** Backlink hint — rendered only when positive. */
  linkCount: number | null;
}

interface EntryCardProps {
  entry: EntryCardEntry;
}

/**
 * An entry card — a neutral surface reading the page's ambient semantic tokens (`--surface` +
 * `--border`), its ink the editorial roles (`--foreground` title, `--muted-foreground`
 * summary/meta) — one seed paints a page, so a grid of cards shares the page theme's palette
 * and stays legible by construction.
 *
 * The shared `EntryTeaser` fuses the title and summary into one paragraph; the shared `EntryMeta`
 * reads out the facts below it. Defensive: a slugless entry degrades to a non-link card (never a
 * dead link); a missing title falls back to a neutral label; missing meta simply omits the row.
 * The whole card is the link (`HoverPrefetchLink`), so the teaser renders its title as plain text
 * with NO slug of its own — a per-title link here would nest an `<a>` inside the card's `<a>`.
 */
export default function EntryCard({ entry }: EntryCardProps) {
  const body: ReactNode = (
    <>
      <EntryTeaser title={entry.title} summary={entry.summary} level={3} />
      <EntryMeta
        kind={entry.kind}
        stage={entry.stage}
        tended={entry.tended}
        linkCount={entry.linkCount}
        color="muted-foreground"
        className={styles.meta}
      />
    </>
  );

  return (
    <li className={styles.card}>
      {entry.slug ? (
        <HoverPrefetchLink href={`/${entry.slug}`} className={styles.link}>
          {body}
        </HoverPrefetchLink>
      ) : (
        <div className={styles.link}>{body}</div>
      )}
    </li>
  );
}
