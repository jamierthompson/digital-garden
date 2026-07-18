import type { CSSProperties, ReactNode } from "react";

import EntryMeta from "@/components/entry/EntryMeta";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import HoverPrefetchLink from "@/components/ui/HoverPrefetchLink";
import { cardSwatches } from "@/lib/cardSwatches";

import styles from "./EntryCard.module.css";

/** The entry fields a card renders — a structural subset of the query rows, so any entry
 *  query (featured, index, …) with these fields can feed the card. */
export interface EntryCardEntry {
  title: string | null;
  slug: string | null;
  summary: string | null;
  kind: string | null;
  stage: "prototype" | "shipped" | "sketch" | null;
  /** The authored last-iterated date (ISO `YYYY-MM-DD`), for the mono readout. */
  iterated: string | null;
  /** Backlink hint — rendered only when positive. */
  linkCount: number | null;
  /** The RESOLVED theme seed (the query's own seed → site default chain, #253). It themes the
   *  plate (via `cardSwatches`, total over any value) AND is shown verbatim in the mono
   *  readout — the "show your work" detail the mockup captions carry: the value the plate is
   *  actually painted with. The slot font is not a card concern. */
  themeSeed: string | null;
}

interface EntryCardProps {
  entry: EntryCardEntry;
}

/**
 * A themed entry card — a solid accent PLATE (mockup 4a), not chrome. It spreads its own
 * engine-solved palette inline via `cardSwatches`, re-binding the generic semantic tokens for
 * this card's subtree only: the plate is `--accent`, its text the contrast-solved `--accent-foreground`
 * pair — so a grid of differently-themed plates needs no per-card scope or `<style>`, and each
 * stays legible by construction. The surrounding shell stays editorial ink.
 *
 * Three type registers, journal-style: display title, serif summary, and the shared
 * `EntryMeta` mono readout. Defensive: a slugless entry degrades to a non-link plate (never a
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
        <Text className={styles.summary}>{entry.summary}</Text>
      ) : null}
      {/* No `color` — the readout wears the plate's own contrast pair via `.meta`. */}
      <EntryMeta
        kind={entry.kind}
        stage={entry.stage}
        iterated={entry.iterated}
        seed={entry.themeSeed}
        linkCount={entry.linkCount}
        className={styles.meta}
      />
    </>
  );

  return (
    <li
      className={styles.card}
      // `cardSwatches` returns generic semantic-token overrides baked as `light-dark()`
      // literals; spread inline they re-bind this card's subtree to its own theme palette
      // (the plate reads `--accent` + `--accent-foreground`). Cast to `CSSProperties`: React types
      // custom props via an index signature a `Record<--*, string>` doesn't match alone.
      style={cardSwatches(entry.themeSeed) as CSSProperties}
    >
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
