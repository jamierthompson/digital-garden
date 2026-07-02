import Link from "next/link";

import styles from "./ShellNav.module.css";

/**
 * The shell's primary navigation.
 *
 * A pure, synchronous, var-consuming component: it reads the global editorial semantic tokens
 * (`var(--text)`, `var(--border)`, `var(--font-face)`) from `:root`. The shell is never
 * brand-scoped — editorial chrome is global; a project's brand is scoped to its own slot.
 */
export default function ShellNav() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Primary">
        <Link href="/" className={styles.brand}>
          Jamie Thompson
        </Link>
        {/* Home is the logo (→ `/`), so it is not a separate nav item. The two reading
            paths + the shell pages: Index (browse everything) · Now · About. */}
        <ul className={styles.links}>
          <li>
            <Link href="/browse" className={styles.link}>
              Index
            </Link>
          </li>
          <li>
            <Link href="/now" className={styles.link}>
              Now
            </Link>
          </li>
          <li>
            <Link href="/about" className={styles.link}>
              About
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
