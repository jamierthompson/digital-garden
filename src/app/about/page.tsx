import type { Metadata } from "next";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "About",
  description:
    "About this digital garden and the person tending it — how the site is built and what lives here.",
  openGraph: {
    title: "About",
    description:
      "About this digital garden and the person tending it — how the site is built and what lives here.",
    type: "profile",
  },
};

/**
 * The shell About page. Static editorial prose — reads the global semantic tokens
 * (`var(--text)`, `var(--font-face)`, …) from `:root`, no brand scope of its own.
 */
export default function AboutPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>About</h1>
      <div className={styles.prose}>
        <p>
          This is a personal portfolio and digital garden — part showcase, part
          notebook. Each project is a self-contained island with its own brand
          color and typeface, composed on one shared foundation.
        </p>
        <p>
          The colors you see are not hand-picked per element. A single brand
          seed runs through an OKLCH engine that derives an accessible palette
          for both light and dark schemes, then bakes it into the page so the
          theme is present before the first paint — no flash, no client-side
          theming pass.
        </p>
        <p>
          The garden grows by accretion: projects, working notes, and the links
          between them. Wander through{" "}
          <span className={styles.emphasis}>Work</span>,{" "}
          <span className={styles.emphasis}>Notes</span>, and{" "}
          <span className={styles.emphasis}>Now</span>.
        </p>
      </div>
    </main>
  );
}
