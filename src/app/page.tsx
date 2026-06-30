import type { Metadata } from "next";
import Link from "next/link";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Home",
  description:
    "A personal portfolio and digital garden — projects, notes, and writing, each themed on a shared foundation.",
};

/**
 * The shell home page. Renders under the shell island's `[data-project]` scope from
 * the root layout, so it reads `var(--brand-*)` / `var(--font-face)` directly — no
 * theme of its own. Deliberately small: a hero plus a few wayfinding links.
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
        <Link href="/work" className={styles.card}>
          <span className={styles.cardTitle}>Work</span>
          <span className={styles.cardBlurb}>
            Projects, each its own brand and font.
          </span>
        </Link>
        <Link href="/notes" className={styles.card}>
          <span className={styles.cardTitle}>Notes</span>
          <span className={styles.cardBlurb}>
            Working notes and the things they link to.
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
