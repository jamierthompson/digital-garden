import Link from "next/link";

import NavLinks from "./NavLinks";
import styles from "./ShellNav.module.css";

/**
 * The shell's primary navigation — the "engineering journal" masthead.
 *
 * A Server Component: it renders a masthead tagline band, the `folio_` logo (Space Grotesk via
 * `--font-display`) and mounts the small Client `NavLinks` leaf for the current-page indicator.
 * Var-consuming only: reads the global editorial semantic tokens (`--font-display`, `--font-mono`,
 * `--text`, `--border`). The shell is never brand-scoped — editorial chrome is global; a
 * project's brand is scoped to its own interactive slot.
 */
export default function ShellNav() {
  return (
    <header className={styles.header}>
      {/* The site tagline as a subtle mono masthead band above the nav (every page) — the
          engineering-journal dateline. A <p>, not a heading: it's site chrome, so each page
          keeps its own h1. */}
      <p className={styles.masthead}>
        The Design-Engineering Garden of Jamie Thompson
      </p>
      <nav className={styles.nav} aria-label="Primary">
        {/* Home is the logo (→ `/`). The trailing `_` is a muted blinking-cursor nod — the
            "folio_" wordmark from the engineering-journal direction. */}
        <Link href="/" className={styles.brand}>
          folio
          <span className={styles.cursor} aria-hidden="true">
            _
          </span>
        </Link>
        <NavLinks />
      </nav>
    </header>
  );
}
