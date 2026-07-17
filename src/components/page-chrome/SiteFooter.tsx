import ContentGrid from "@/components/layout/ContentGrid";
import HoverPrefetchLink from "@/components/ui/HoverPrefetchLink";
import TextLink from "@/components/ui/TextLink";
import Text from "@/components/typography/Text";

import styles from "./SiteFooter.module.css";

// Copyright year, resolved ONCE at module load (build time for the prerendered shell), not
// during render — so it stays outside Cache Components' runtime-data tracking (reading "now"
// mid-render would force a Suspense/`use cache` boundary) while still refreshing on each
// deploy. The repo otherwise never reads the current time; this is the only such site.
const COPYRIGHT_YEAR = new Date().getFullYear();

/**
 * The global site footer — the engineering-journal colophon. A quiet mono row: the copyright
 * on the left, a "browse everything →" wayfinding link to the Index on the right, over a thin
 * rule. The band is a `ContentGrid` merged onto the `<footer>` (the site's one alignment
 * system), its row in the `wide` lane. Shell chrome (var-consuming editorial tokens, never
 * theme-scoped); rendered once in the root layout so every route carries it.
 */
export default function SiteFooter() {
  return (
    <ContentGrid asChild>
      <footer className={styles.footer}>
        <Text variant="meta" color="muted-foreground" asChild>
          <div className={styles.inner}>
            <span>© {COPYRIGHT_YEAR} Jamie Thompson</span>
            <TextLink variant="muted" asChild className={styles.link}>
              <HoverPrefetchLink href="/browse">
                browse everything →
              </HoverPrefetchLink>
            </TextLink>
          </div>
        </Text>
      </footer>
    </ContentGrid>
  );
}
