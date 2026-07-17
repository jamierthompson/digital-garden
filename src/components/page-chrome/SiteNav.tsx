import ContentGrid from "@/components/layout/ContentGrid";

import Masthead from "./Masthead";
import NavLinks from "./NavLinks";
import SchemeToggle from "./SchemeToggle";
import Wordmark from "./Wordmark";
import styles from "./SiteNav.module.css";

/**
 * The shell's primary navigation — the "engineering journal" masthead. A Server Component
 * that composes the chrome pieces: the `Masthead` byline band, then the nav band — a
 * `ContentGrid` merged onto the `<nav>` so the band shares the site's one alignment system,
 * its row in the `wide` lane — holding the `Wordmark` home link and the right cluster: the
 * primary `NavLinks` (the current-page client leaf) and the site-wide `SchemeToggle` (the
 * shell's one client island).
 */
export default function SiteNav(): React.ReactElement {
  return (
    <header className={styles.header}>
      <Masthead />
      <ContentGrid asChild>
        <nav className={styles.nav} aria-label="Primary">
          <div className={styles.row}>
            <Wordmark />
            {/* Grouped so the wordmark stays hard-left and links + toggle sit hard-right. */}
            <div className={styles.navEnd}>
              <NavLinks />
              <SchemeToggle />
            </div>
          </div>
        </nav>
      </ContentGrid>
    </header>
  );
}
