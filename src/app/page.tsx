import type { Metadata } from "next";
import { VisuallyHidden } from "radix-ui";

import EntryCard from "@/components/entry/EntryCard";
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
 * ordered by rank, as `EntryCard`s — each a bounded brand slot that themes itself from its
 * own `brandColor` (see `EntryCard`), while the surrounding shell stays editorial ink.
 */
export default async function Home() {
  const featured = await sanityFetch(FEATURED_QUERY);

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Notes, essays, and things I&rsquo;m building in the open.
        </h1>
      </section>

      {featured.length > 0 ? (
        <section className={styles.featured} aria-labelledby="featured-heading">
          {/* The visual design (mockup 4a) omits a "Featured" label — the plates follow the
              hero directly. The heading is kept but visually hidden (Radix VisuallyHidden via
              `asChild`, so it stays a real <h2>) — the section keeps its accessible name and
              the document outline stays intact. */}
          <VisuallyHidden.Root asChild>
            <h2 id="featured-heading">Featured</h2>
          </VisuallyHidden.Root>
          <ul className={styles.grid}>
            {featured.map((entry) => (
              <EntryCard key={entry._id} entry={entry} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
