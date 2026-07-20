import Cluster from "@/components/layout/Cluster";
import ContentGrid from "@/components/layout/ContentGrid";

import Logo from "./Logo";
import MobileNav from "./MobileNav";
import NavLinks from "./NavLinks";
import SchemeToggle from "./SchemeToggle";
import styles from "./SiteNav.module.css";
import TulipMark from "./TulipMark";

/**
 * The shell's header band — a Server Component composing the chrome pieces into one row: the
 * `Logo` home link at the leading edge, and hard-right the primary `NavLinks` (the current-page
 * client leaf) beside the site-wide `SchemeToggle` (the shell's one client island). The band is
 * a `ContentGrid` merged onto the `<header>`, so it shares the site's one alignment system, its
 * row in the `wide` lane.
 *
 * The scheme toggle sits inside the banner but OUTSIDE the `<nav>`, so assistive tech announces
 * it as a sibling control rather than an item of the primary navigation.
 */
export default function SiteNav(): React.ReactElement {
  return (
    <ContentGrid asChild>
      <header className={styles.header}>
        <div className={styles.row}>
          <Logo>
            <TulipMark />
          </Logo>
          <Cluster className={styles.controls}>
            {/* Both presentations render server-side and CSS picks between them — no breakpoint
                read in JS, so nothing swaps at hydration and neither flashes on first paint. */}
            <nav aria-label="Primary" className={styles.inlineNav}>
              <Cluster asChild>
                <NavLinks />
              </Cluster>
            </nav>
            <div className={styles.mobileNav}>
              <MobileNav />
            </div>
            <SchemeToggle />
          </Cluster>
        </div>
      </header>
    </ContentGrid>
  );
}
