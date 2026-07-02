import Link from "next/link";
import type { CSSProperties } from "react";

import { cardSwatches } from "@/lib/cardSwatches";

import styles from "./EntryCard.module.css";

/** The entry fields a card renders — a structural subset of the query rows, so any entry
 *  query (featured, index, …) with these fields can feed the card. */
export interface EntryCardEntry {
  title: string | null;
  slug: string | null;
  blurb: string | null;
  /** The engine seed. `cardSwatches` is total/defensive over any value, incl. null/garbage. */
  brandColor: string | null;
}

interface EntryCardProps {
  entry: EntryCardEntry;
}

/**
 * A branded entry card — a bounded brand SLOT, not chrome. It spreads its own engine-solved
 * palette inline via `cardSwatches`, re-binding the generic semantic tokens
 * (`--surface`/`--text`/`--border`/`--accent`) for this card's subtree only, so a grid of
 * differently-branded cards needs no per-card scope or `<style>`. The surrounding shell stays
 * editorial ink.
 *
 * Rendered as an `<li>` for the card grid. Defensive: a slugless entry degrades to a non-link
 * heading (never a dead link); a missing title falls back to a neutral label.
 */
export default function EntryCard({ entry }: EntryCardProps) {
  const title = entry.title ?? "Untitled entry";

  return (
    <li
      className={styles.card}
      // `cardSwatches` returns generic semantic-token overrides baked as `light-dark()`
      // literals; spread inline they re-bind this card's subtree to its own brand palette.
      // Cast to `CSSProperties`: React types custom props via an index signature a
      // `Record<--*, string>` doesn't match alone.
      style={cardSwatches(entry.brandColor) as CSSProperties}
    >
      {entry.slug ? (
        <Link href={`/${entry.slug}`} className={styles.link}>
          <h3 className={styles.title}>{title}</h3>
          {entry.blurb ? <p className={styles.blurb}>{entry.blurb}</p> : null}
        </Link>
      ) : (
        <h3 className={styles.title}>{title}</h3>
      )}
    </li>
  );
}
