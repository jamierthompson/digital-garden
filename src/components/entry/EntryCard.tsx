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
 * The card owns its own title + summary markup: the title as a real `<h3>` over the summary as
 * its own body paragraph, then the shared `EntryMeta` readout. Each entry surface renders that
 * pairing itself rather than sharing one atom, so the card can be restyled without moving the
 * Index rows or the Related list with it.
 *
 * Defensive: a slugless entry degrades to a non-link card (never a dead link); a blank title
 * falls back to a neutral label (never a nameless node in the outline, whose accessible name
 * would silently degrade to the summary); missing meta simply omits the row. The whole card is
 * the link (`HoverPrefetchLink`), so the title is plain text with no link of its own — a
 * per-title link here would nest an `<a>` inside the card's `<a>`.
 */
export default function EntryCard({ entry }: EntryCardProps) {
  // Nullish-coalescing isn't enough: a blank Studio field serialises to "" (a valid string),
  // which would render an empty heading. Treat blank/whitespace-only as missing.
  const displayTitle = entry.title?.trim() ? entry.title : "Untitled entry";

  const body: ReactNode = (
    <>
      <Heading level={3} color="foreground">
        {displayTitle}
      </Heading>
      {/* Guarded on `.trim()` (not bare truthiness) so a whitespace-only field renders no
          paragraph at all rather than an empty node taking the card's stack gap. */}
      {entry.summary?.trim() ? (
        <Text variant="body" color="muted-foreground">
          {entry.summary}
        </Text>
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
