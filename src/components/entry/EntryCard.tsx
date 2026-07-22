import type { ReactNode } from "react";

import EntryMeta from "@/components/entry/EntryMeta";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
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
 * Three type registers, journal-style: display title, serif summary, and the shared
 * `EntryMeta` meta readout. Defensive: a slugless entry degrades to a non-link card (never a
 * dead link); a missing title falls back to a neutral label; missing meta simply omits the row.
 */
export default function EntryCard({ entry }: EntryCardProps) {
  // Nullish-coalescing isn't enough: a blank Studio field serialises to "" (a valid string),
  // which would render an empty <h3> — a nameless heading in the outline and a link whose
  // accessible name silently degrades to the summary. Treat blank/whitespace-only as missing.
  const title = entry.title?.trim() ? entry.title : "Untitled entry";

  const body: ReactNode = (
    <>
      <Heading level={3}>{title}</Heading>
      {entry.summary ? (
        <Text color="muted-foreground">{entry.summary}</Text>
      ) : null}
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
