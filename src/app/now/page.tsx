import type { Metadata } from "next";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Now",
  description:
    "A now page — what I'm focused on at the moment, in the spirit of nownownow.com.",
  openGraph: {
    title: "Now",
    description:
      "A now page — what I'm focused on at the moment, in the spirit of nownownow.com.",
    type: "website",
  },
};

/**
 * The shell /now page (after nownownow.com). Static, themed content under the shell
 * island's scope (§3.1).
 */
export default function NowPage() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Now</h1>
        <p className={styles.updated}>Updated June 2026</p>
      </header>
      <ul className={styles.list}>
        <li className={styles.item}>
          Building this digital garden — the themed-island architecture and the
          OKLCH theming engine behind it.
        </li>
        <li className={styles.item}>
          Writing up working notes as I go, and linking them together as a small
          knowledge graph.
        </li>
        <li className={styles.item}>
          Reading about color science, accessible contrast, and how to keep a
          personal site fast.
        </li>
      </ul>
      <p className={styles.footnote}>
        This is a{" "}
        <a
          className={styles.link}
          href="https://nownownow.com/about"
          rel="noopener noreferrer"
        >
          now page
        </a>
        , and you could make one too.
      </p>
    </main>
  );
}
