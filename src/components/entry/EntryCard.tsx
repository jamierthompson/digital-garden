import type { ReactNode } from "react";

import EntryMeta from "@/components/entry/EntryMeta";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import HoverPrefetchLink from "@/components/ui/HoverPrefetchLink";
import { linkableSlug, visibleText } from "@/lib/visibleText";

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
 * A slugless entry degrades to a non-link card, a blank title to a neutral label, and missing
 * meta simply omits the row — the shapes a draft actually has. "Blank" is decided by
 * `visibleText`, not by truthiness: whitespace-only publishes clean and a stega-encoded cleared
 * field is truthy, so neither may name a card. The whole card is the link
 * (`HoverPrefetchLink`), so the title is plain text with no link of its own — a per-title link
 * here would nest an `<a>` inside the card's `<a>`.
 */
export default function EntryCard({ entry }: EntryCardProps) {
  // `visibleText`, not a bare `||`: `required()` in the Studio is a falsy check with no trim, so
  // a whitespace-only title publishes clean; `summary` has no presence rule at all; and drafts
  // (which Visual Editing renders) are never validated and arrive stega-encoded, where a cleared
  // field is truthy invisible characters. Blank in any of those shapes must not name this card.
  const displayTitle = visibleText(entry.title) ?? "Untitled entry";
  const summary = visibleText(entry.summary);
  const slug = linkableSlug(entry.slug);

  const body: ReactNode = (
    <>
      <Heading level={3} color="foreground">
        {displayTitle}
      </Heading>
      {summary ? (
        <Text
          variant="body"
          color="muted-foreground"
          className={styles.summary}
        >
          {summary}
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
      {slug ? (
        <HoverPrefetchLink href={`/${slug}`} className={styles.link}>
          {body}
        </HoverPrefetchLink>
      ) : (
        <div className={styles.link}>{body}</div>
      )}
    </li>
  );
}
