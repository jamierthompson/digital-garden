import Link from "next/link";

import styles from "./ShellNav.module.css";

/**
 * The shell's primary navigation. [§2]
 *
 * A pure, synchronous, var-consuming component: it reads `var(--brand-*)` / `var(--font-face)`
 * from whatever scope it renders under (the shell island's `[data-project]` scope in the root
 * layout), so it carries no theme of its own.
 */
export default function ShellNav() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Primary">
        <Link href="/" className={styles.brand}>
          Digital Garden
        </Link>
        <ul className={styles.links}>
          <li>
            <Link href="/work" className={styles.link}>
              Work
            </Link>
          </li>
          <li>
            <Link href="/about" className={styles.link}>
              About
            </Link>
          </li>
          <li>
            <Link href="/now" className={styles.link}>
              Now
            </Link>
          </li>
          <li>
            <Link href="/notes" className={styles.link}>
              Notes
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
