import type { Metadata } from "next";

import EntrySummary from "@/components/entry/EntrySummary";
import Page from "@/components/layout/Page";
import Stack from "@/components/layout/Stack";
import PageTheme from "@/components/theme/PageTheme";
import { sitePageThemeSeed } from "@/components/theme/sitePageSeed";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import TextLink from "@/components/ui/TextLink";
import { space } from "@/lib/tokens";
import { NOW_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Now",
  description:
    "What I'm focused on at the moment — a dated stream, in the spirit of nownownow.com.",
  openGraph: {
    title: "Now",
    description:
      "What I'm focused on at the moment — a dated stream, in the spirit of nownownow.com.",
    type: "website",
  },
};

/**
 * The `/now` page (after nownownow.com) — now Sanity-driven: a reverse-chronological stream of
 * `kind == "now"` entries, newest first. Shell-owned editorial chrome (global semantic tokens,
 * no theme scope). Each update links to its own flat `/[slug]` for the full text. This is the
 * only surface that lists now-updates.
 */
export default async function NowPage() {
  // Seed on the awaited path → synchronous `<PageTheme>`; its `:root` `<style>` hoists into
  // `<head>` ahead of the chrome (prerendered static shell, flash-free, #187). See `sitePageThemeSeed`.
  const themeSeed = await sitePageThemeSeed("now");
  const updates = await sanityFetch(NOW_QUERY);

  return (
    <>
      <PageTheme seed={themeSeed} />
      <Page>
        <Stack gap={space(6)}>
          <Stack asChild gap={space(2)}>
            <header>
              <Heading level={1}>Now</Heading>
              <Text variant="lede" color="muted-foreground">
                What I&apos;m focused on at the moment. Newest first.
              </Text>
            </header>
          </Stack>

          {updates.length === 0 ? (
            <Text variant="lede" color="muted-foreground">
              No now-updates yet — check back soon.
            </Text>
          ) : (
            <Stack asChild gap={space(6)}>
              <ul className={styles.list}>
                {updates.map((update) => (
                  <EntrySummary
                    key={update._id}
                    // `||`, not `??`: a cleared title serialises to "" and would otherwise
                    // reach an empty heading instead of this surface's "update" wording.
                    title={update.title || "Untitled update"}
                    slug={update.slug}
                    summary={update.summary}
                    tended={update.tended}
                    linkCount={update.linkCount}
                  />
                ))}
              </ul>
            </Stack>
          )}

          <Text color="muted-foreground">
            This is a{" "}
            <TextLink
              variant="accent"
              href="https://nownownow.com/about"
              rel="noopener noreferrer"
            >
              now page
            </TextLink>
            , and you could make one too.
          </Text>
        </Stack>
      </Page>
    </>
  );
}
