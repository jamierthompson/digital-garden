import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

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
  /** The engine seed. Themes the plate (via `cardSwatches`, total over any value) AND is shown
   *  verbatim in the mono readout — the "show your work" detail the mockup captions carry. */
  brandColor: string | null;
}

interface EntryCardProps {
  entry: EntryCardEntry;
}

/**
 * A branded entry card — a solid brand PLATE (mockup 4a), not chrome. It spreads its own
 * engine-solved palette inline via `cardSwatches`, re-binding the generic semantic tokens for
 * this card's subtree only: the plate is `--accent`, its text the contrast-solved `--on-accent`
 * pair — so a grid of differently-branded plates needs no per-card scope or `<style>`, and each
 * stays legible by construction. The surrounding shell stays editorial ink.
 *
 * Three type registers, journal-style: display title, serif blurb, mono meta (the maturity
 * stage · the OKLCH seed). Defensive: a slugless entry degrades to a non-link plate (never a
 * dead link); a missing title falls back to a neutral label; missing meta simply omits the row.
 */
export default function EntryCard({ entry }: EntryCardProps) {
  const title = entry.title ?? "Untitled entry";
  const meta = [entry.stage, entry.brandColor].filter(Boolean).join(" · ");

  const body: ReactNode = (
    <>
      <h3 className={styles.title}>{title}</h3>
      {entry.blurb ? <p className={styles.blurb}>{entry.blurb}</p> : null}
      {meta ? <p className={styles.meta}>{meta}</p> : null}
    </>
  );

  return (
    <li
      className={styles.card}
      // `cardSwatches` returns generic semantic-token overrides baked as `light-dark()`
      // literals; spread inline they re-bind this card's subtree to its own brand palette
      // (the plate reads `--accent` + `--on-accent`). Cast to `CSSProperties`: React types
      // custom props via an index signature a `Record<--*, string>` doesn't match alone.
      style={cardSwatches(entry.brandColor) as CSSProperties}
    >
      {entry.slug ? (
        <Link href={`/${entry.slug}`} className={styles.link}>
          {body}
        </Link>
      ) : (
        <div className={styles.link}>{body}</div>
      )}
    </li>
  );
}
