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
 * A slugless entry degrades to a non-link card, an absent title to a neutral label, and missing
 * meta simply omits the row — the shapes a draft actually has. The whole card is the link
 * (`HoverPrefetchLink`), so the title is plain text with no link of its own — a per-title link
 * here would nest an `<a>` inside the card's `<a>`.
 */
export default function EntryCard({ entry }: EntryCardProps) {
  // `||`, not `??`: `title` is required in the Studio, but a draft (which Visual Editing
  // renders) can carry no title at all, and a cleared field serialises to "" rather than null.
  const displayTitle = entry.title || "Untitled entry";

  const body: ReactNode = (
    <>
      <Heading level={3} color="foreground">
        {displayTitle}
      </Heading>
      {entry.summary ? (
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
