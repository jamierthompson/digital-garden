import type { Metadata } from "next";
import { VisuallyHidden } from "radix-ui";

import EntryCard from "@/components/entry/EntryCard";
import Grid from "@/components/layout/Grid";
import Page from "@/components/layout/Page";
import Stack from "@/components/layout/Stack";
import Heading from "@/components/typography/Heading";
import PageTheme from "@/components/theme/PageTheme";
import { sitePageThemeSeed } from "@/components/theme/sitePageSeed";
import { space } from "@/lib/tokens";
import { FEATURED_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Jamie Thompson — design engineer. A personal portfolio and digital garden, each entry an independently themed island on one shared foundation.",
};

/**
 * The featured home — the curated front door for a hurried evaluator (the Index at `/browse`
 * is the wanderer's path). It renders the entries an editor promoted with a `featuredRank`,
 * ordered by rank, as `EntryCard`s — one seed paints the page, so the cards read the page
 * theme's ambient tokens, and the surrounding shell stays editorial ink.
 */
export default async function Home() {
  // Both reads are `use cache`, so they resolve into the prerendered static shell — the theme
  // seed on the page's own awaited path, fed to a synchronous `<PageTheme>`, whose `:root`
  // `<style>` React hoists into `<head>` ahead of the chrome, so first paint is themed (#187).
  const themeSeed = await sitePageThemeSeed("home");
  const featured = await sanityFetch(FEATURED_QUERY);

  return (
    <>
      <PageTheme seed={themeSeed} />
      <Page>
        {/* The featured grid runs wider than the reading measure — the whole page block takes
            the wide lane. */}
        <Stack gap={space(9)} className={styles.content}>
          <Stack asChild gap={space(4)}>
            <section>
              {/* The landing statement — the site's one oversized display moment (the scale's
            top size, set in the module) and its self-description in a single sentence.
            Emphasis is type-borne: Newsreader's true italic, not a color spend. */}
              <Heading level={1} variant="display" className={styles.title}>
                a design-engineering garden &mdash; notes, essays, and{" "}
                <em>things I&rsquo;m building</em> in the open.
              </Heading>
            </section>
          </Stack>

          {featured.length > 0 ? (
            <Stack asChild gap={space(4)}>
              <section aria-labelledby="featured-heading">
                {/* The visual design (mockup 4a) omits a "Featured" label — the cards follow the
              hero directly. The heading is kept but visually hidden (Radix VisuallyHidden via
              `asChild`, so it stays a real <h2>) — the section keeps its accessible name and
              the document outline stays intact. */}
                <VisuallyHidden.Root asChild>
                  <h2 id="featured-heading">Featured</h2>
                </VisuallyHidden.Root>
                <Grid asChild min="20rem">
                  <ul className={styles.grid}>
                    {featured.map((entry) => (
                      <EntryCard key={entry._id} entry={entry} />
                    ))}
                  </ul>
                </Grid>
              </section>
            </Stack>
          ) : null}
        </Stack>
      </Page>
    </>
  );
}
