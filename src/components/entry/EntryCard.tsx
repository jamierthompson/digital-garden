import type { CSSProperties, ReactNode } from "react";

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
  blurb: string | null;
  /** Maturity badge — part of the card's mono readout. */
  stage: "prototype" | "shipped" | "sketch" | null;
  /** The entry's theme. Its `color` themes the plate (via `cardSwatches`, total over any value)
   *  AND is shown verbatim in the mono readout — the "show your work" detail the mockup captions
   *  carry. The card reads only `color`; the slot font is not a card concern. */
  theme: { color: string | null } | null;
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
 * Three type registers, journal-style: display title, serif blurb, mono meta (the maturity
 * stage · the OKLCH seed). Defensive: a slugless entry degrades to a non-link plate (never a
 * dead link); a missing title falls back to a neutral label; missing meta simply omits the row.
 */
export default function EntryCard({ entry }: EntryCardProps) {
  // Nullish-coalescing isn't enough: a blank Studio field serialises to "" (a valid string),
  // which would render an empty <h3> — a nameless heading in the outline and a link whose
  // accessible name silently degrades to the blurb. Treat blank/whitespace-only as missing.
  const title = entry.title?.trim() ? entry.title : "Untitled entry";
  const meta = [entry.stage, entry.theme?.color].filter(Boolean).join(" · ");

  const body: ReactNode = (
    <>
      <Heading level={3}>{title}</Heading>
      {entry.blurb ? <Text className={styles.blurb}>{entry.blurb}</Text> : null}
      {meta ? (
        <Text variant="meta" className={styles.meta}>
          {meta}
        </Text>
      ) : null}
    </>
  );

  return (
    <li
      className={styles.card}
      // `cardSwatches` returns generic semantic-token overrides baked as `light-dark()`
      // literals; spread inline they re-bind this card's subtree to its own theme palette
      // (the plate reads `--accent` + `--accent-foreground`). Cast to `CSSProperties`: React types
      // custom props via an index signature a `Record<--*, string>` doesn't match alone.
      style={cardSwatches(entry.theme?.color) as CSSProperties}
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
