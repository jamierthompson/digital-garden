import type { Metadata } from "next";
import Link from "next/link";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Home",
  description:
    "A personal portfolio and digital garden — projects, notes, and writing, each themed on a shared foundation.",
};

/**
 * The shell home page. Editorial chrome: reads the global semantic tokens (`var(--text)`,
 * `var(--font-face)`, …) from `:root` — no brand scope of its own. Deliberately small: a
 * hero plus a few wayfinding links.
 */
export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1 className={styles.title}>Digital Garden</h1>
        <p className={styles.tagline}>
          A personal portfolio and digital garden. Each project is a
          self-contained, independently themed island composed on one shared
          foundation.
        </p>
      </section>
      <nav className={styles.wayfinding} aria-label="Sections">
        <Link href="/browse" className={styles.card}>
          <span className={styles.cardTitle}>Index</span>
          <span className={styles.cardBlurb}>
            Everything in the garden — projects, essays, and notes.
          </span>
        </Link>
        <Link href="/about" className={styles.card}>
          <span className={styles.cardTitle}>About</span>
          <span className={styles.cardBlurb}>
            Who&apos;s tending the garden.
          </span>
        </Link>
        <Link href="/now" className={styles.card}>
          <span className={styles.cardTitle}>Now</span>
          <span className={styles.cardBlurb}>
            What I&apos;m focused on lately.
          </span>
        </Link>
      </nav>
    </main>
  );
}
