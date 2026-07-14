import Cluster from "@/components/layout/Cluster";
import Container from "@/components/layout/Container";
import Text from "@/components/typography/Text";
import { space } from "@/lib/tokens";

import styles from "./Masthead.module.css";

/**
 * The masthead byline band above the nav (every page) — the engineering-journal dateline.
 * Full-bleed 1px hairline; the inner row is a wrapping `Cluster` capped to the page column
 * (`Container`), so the byline's left edge aligns with the wordmark and the page's hero, and
 * the dateline drops to its own line intrinsically when the row is tight (no `@media`).
 */
export default function Masthead(): React.ReactElement {
  return (
    <div className={styles.masthead}>
      <Cluster asChild gap={space(4)}>
        <Container className={styles.inner}>
          {/* A <p>, not a heading: it's site chrome, so each page keeps its own h1. */}
          <Text variant="meta" color="muted-foreground">
            The Design-Engineering Garden of Jamie Thompson
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
        </Container>
      </Cluster>
    </div>
  );
}
