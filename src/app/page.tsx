import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { cardSwatches } from "@/lib/cardSwatches";
import { FEATURED_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Jamie Thompson — design engineer. A personal portfolio and digital garden, each project an independently themed island on one shared foundation.",
};

/**
 * The featured home — the curated front door for a hurried evaluator (the Index at `/browse`
 * is the wanderer's path). It renders the entries an editor promoted with a `featuredRank`,
 * ordered by rank, as BRANDED cards: each card spreads its own engine-solved palette inline
 * via `cardSwatches`, re-binding the generic semantic tokens
 * (`--surface`/`--text`/`--border`/`--accent`) for that card's subtree only — a dozen
 * differently-branded cards on one page with no per-card scope or `<style>`. A card is a
 * bounded slot, not chrome; the surrounding shell stays editorial ink.
 */
export default async function Home() {
  const featured = await sanityFetch(FEATURED_QUERY);

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1 className={styles.title}>Jamie Thompson</h1>
        <p className={styles.tagline}>
          A personal portfolio and digital garden — each project a
          self-contained, independently themed island, composed on one shared
          foundation.
        </p>
      </section>

      {featured.length > 0 ? (
        <section className={styles.featured} aria-labelledby="featured-heading">
          <h2 id="featured-heading" className={styles.sectionHeading}>
            Featured
          </h2>
          <ul className={styles.grid}>
            {featured.map((entry) => (
              <li
                key={entry._id}
                className={styles.card}
                // `cardSwatches` returns generic semantic-token overrides
                // (`--surface`/`--text`/`--border`/`--accent`) baked as `light-dark()`
                // literals; spread inline they re-bind this card's subtree to its own
                // engine-solved brand palette. Cast to `CSSProperties`: React types custom
                // props via an index signature a `Record<--*, string>` doesn't match alone.
                style={cardSwatches(entry.brandColor) as CSSProperties}
              >
                {entry.slug ? (
                  <Link href={`/${entry.slug}`} className={styles.cardLink}>
                    <h3 className={styles.cardTitle}>
                      {entry.title ?? "Untitled entry"}
                    </h3>
                    {entry.blurb ? (
                      <p className={styles.cardBlurb}>{entry.blurb}</p>
                    ) : null}
                  </Link>
                ) : (
                  <h3 className={styles.cardTitle}>
                    {entry.title ?? "Untitled entry"}
                  </h3>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className={styles.wayfinding} aria-label="More">
        <Link href="/browse" className={styles.browseLink}>
          Browse everything →
        </Link>
      </nav>
    </main>
  );
}
