import Cluster from "@/components/layout/Cluster";
import ContentGrid from "@/components/layout/ContentGrid";
import Text from "@/components/typography/Text";

import styles from "./Masthead.module.css";

/**
 * The masthead byline band above the nav (every page) — the engineering-journal dateline.
 * The band root is a `ContentGrid` (full-bleed 1px hairline; the site's one alignment system);
 * the inner row is a wrapping `Cluster` in the `wide` lane, so the byline's left edge aligns
 * with the wordmark below it, and the dateline drops to its own line intrinsically when the
 * row is tight (no `@media`). The row's gap is set in the module (Cluster's `--cluster-gap`
 * channel), so the band's designed dimensions all live in one place.
 */
export default function Masthead(): React.ReactElement {
  return (
    <ContentGrid className={styles.masthead}>
      <Cluster asChild>
        <div className={styles.inner}>
          {/* A <p>, not a heading: it's site chrome, so each page keeps its own h1. */}
          <Text variant="meta" color="muted-foreground">
            a design-engineering garden
          </Text>
          {/* Quiet masthead balance — decorative journal dateline, hidden from AT. */}
          <Text
            variant="meta"
            color="muted-foreground"
            className={styles.dateline}
            aria-hidden="true"
          >
            Est. 2026
          </Text>
        </div>
      </Cluster>
    </ContentGrid>
  );
}
