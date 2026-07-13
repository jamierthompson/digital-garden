import Link from "next/link";

import Text from "@/components/typography/Text";

import NavLinks from "./NavLinks";
import SchemeToggle from "./SchemeToggle";
import styles from "./SiteNav.module.css";

/**
 * The shell's primary navigation — the "engineering journal" masthead.
 *
 * A Server Component: it renders a masthead tagline band, the `folio_` logo (Space Grotesk via
 * `--font-heading`) and mounts the small Client `NavLinks` leaf for the current-page indicator.
 * Var-consuming only. Most chrome reads the editorial semantic tokens (`--font-mono`, `--foreground`,
 * `--border`); the signature marks — the wordmark, its cursor, and the masthead hairline — read the
 * page-accent tokens (`--accent-text`, `--accent`), which the page's own `<html>` theme re-binds, so
 * the masthead picks up each page's accent. The shell itself is never theme-scoped: the accent
 * arrives through the page root, not a shell-local scope.
 */
export default function SiteNav() {
  return (
    <header className={styles.header}>
      {/* The masthead byline band above the nav (every page) — the engineering-journal
          dateline. Its inner row is constrained to the same content column as the nav below,
          so the byline's left edge aligns with the `folio_` wordmark and the page's hero.
          A <p>, not a heading: it's site chrome, so each page keeps its own h1. */}
      <div className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <Text variant="meta" className={styles.byline}>
            The Design-Engineering Garden of Jamie Thompson
          </Text>
          {/* Quiet masthead balance — decorative journal dateline, hidden from AT. */}
          <Text variant="meta" className={styles.dateline} aria-hidden="true">
            Est. 2026
          </Text>
        </div>
      </div>
      <nav className={styles.nav} aria-label="Primary">
        {/* Home is the logo (→ `/`). The trailing `_` is a muted blinking-cursor nod — the
            "folio_" wordmark from the engineering-journal direction. */}
        <Link href="/" className={styles.wordmark}>
          folio
          <span className={styles.cursor} aria-hidden="true">
            _
          </span>
        </Link>
        {/* Right cluster: the primary links plus the site-wide scheme toggle (the shell's
            one client island). Grouped so `folio_` stays hard-left and both sit hard-right. */}
        <div className={styles.navEnd}>
          <NavLinks />
          <SchemeToggle />
        </div>
      </nav>
    </header>
  );
}
