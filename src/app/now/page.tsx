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

// Format an authored `iterated` date (an ISO `YYYY-MM-DD` from Sanity's `date` field) into a
// readable stamp. Pinned to UTC so the server-rendered string is stable regardless of the
// deploy region's timezone.
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  // A malformed value (Sanity's `date` field should never emit one, but the API path could)
  // yields an Invalid Date whose formatted string is the literal "Invalid Date" — drop it
  // rather than render garbage in the <time> stamp.
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

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
      <Page width="content">
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
                {updates.map((update) => {
                  const date = formatDate(update.iterated);
                  return (
                    <EntrySummary
                      key={update._id}
                      title={update.title ?? "Untitled update"}
                      slug={update.slug}
                      summary={update.summary}
                      linkCount={update.linkCount}
                      date={
                        date && update.iterated
                          ? { dateTime: update.iterated, label: date }
                          : null
                      }
                    />
                  );
                })}
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
