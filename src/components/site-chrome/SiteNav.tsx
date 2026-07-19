import ContentGrid from "@/components/layout/ContentGrid";

import NavLinks from "./NavLinks";
import SchemeToggle from "./SchemeToggle";
import styles from "./SiteNav.module.css";

/**
 * The shell's header band — a Server Component composing the chrome pieces into one row, set
 * hard-right: the primary `NavLinks` (the current-page client leaf) beside the site-wide
 * `SchemeToggle` (the shell's one client island). The band is a `ContentGrid` merged onto the
 * `<header>`, so it shares the site's one alignment system, its row in the `wide` lane.
 *
 * The scheme toggle sits inside the banner but OUTSIDE the `<nav>`, so assistive tech announces
 * it as a sibling control rather than an item of the primary navigation.
 */
export default function SiteNav(): React.ReactElement {
  return (
    <ContentGrid asChild>
      <header className={styles.header}>
        <div className={styles.row}>
          <nav aria-label="Primary">
            <NavLinks />
          </nav>
          <SchemeToggle />
        </div>
      </header>
    </ContentGrid>
  );
}
