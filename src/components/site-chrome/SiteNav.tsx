import ContentGrid from "@/components/layout/ContentGrid";

import Logo from "./Logo";
import NavLinks from "./NavLinks";
import SchemeToggle from "./SchemeToggle";
import styles from "./SiteNav.module.css";

/**
 * The shell's header band — a Server Component composing the chrome pieces into one row: the
 * `Logo` home link hard-left, and hard-right the primary `NavLinks` (the current-page client
 * leaf) beside the site-wide `SchemeToggle` (the shell's one client island). The band is a
 * `ContentGrid` merged onto the `<header>`, so it shares the site's one alignment system, its
 * row in the `wide` lane.
 *
 * The logo and the scheme toggle sit inside the banner but OUTSIDE the `<nav>`, so assistive
 * tech announces the logo as banner-level site identity and the toggle as a sibling control —
 * neither reads as an item of the primary navigation.
 */
export default function SiteNav(): React.ReactElement {
  return (
    <ContentGrid asChild>
      <header className={styles.header}>
        <div className={styles.row}>
          <Logo>
            <FlowerMark />
          </Logo>
          {/* Grouped so the logo stays hard-left and nav + toggle sit hard-right. */}
          <div className={styles.navEnd}>
            <nav aria-label="Primary">
              <NavLinks />
            </nav>
            <SchemeToggle />
          </div>
        </div>
      </header>
    </ContentGrid>
  );
}

/**
 * Placeholder mark — an emoji-style flower: five rounded petals around a center disc. No
 * width/height attributes; `Logo`'s `--logo-size` token sizes it.
 */
function FlowerMark(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="6" r="4.6" />
      <circle cx="17.7" cy="10.1" r="4.6" />
      <circle cx="15.5" cy="16.9" r="4.6" />
      <circle cx="8.5" cy="16.9" r="4.6" />
      <circle cx="6.3" cy="10.1" r="4.6" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}
