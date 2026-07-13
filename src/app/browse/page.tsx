import type { Metadata } from "next";

import EntrySummary from "@/components/entry/EntrySummary";
import Page from "@/components/layout/Page";
import Stack from "@/components/layout/Stack";
import PageTheme from "@/components/theme/PageTheme";
import { sitePageThemeSeed } from "@/components/theme/sitePageSeed";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import { space } from "@/lib/tokens";
import { INDEX_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Index",
  description:
    "Every entry in the garden — projects, essays, and now-updates, browsable in one place.",
};

// The kinds in display order, with their section labels. A named constant so the order and
// wording live in one place, not as magic strings scattered through the render.
//
// `note` is deliberately absent: notes are excluded from the Index surface (a UI decision) —
// they remain first-class content, still reachable at their flat `/[slug]` and through
// backlinks, just not listed here. The INDEX_QUERY still returns them (they're simply not
// rendered), so this stays a pure presentation filter, not a data-model change.
const KIND_SECTIONS = [
  { kind: "project", label: "Projects" },
  { kind: "essay", label: "Essays" },
  { kind: "now", label: "Now" },
] as const;

/**
 * The `/browse` route (labelled "index" in the nav) — the browsable list of every entry, the wanderer's reading path
 * (the featured home `/` is the hurried evaluator's). Shell-owned editorial chrome: it reads
 * the global semantic tokens, with NO per-entry theme (a project's theme lives on its own
 * detail slot, not here). Groups entries by `kind` (notes excluded — see `KIND_SECTIONS`),
 * shows the `stage` maturity badge and a backlink hint, and links each to its flat `/[slug]`.
 */
export default async function IndexPage() {
  // Seed on the awaited path → synchronous `<PageTheme>`; its `:root` `<style>` hoists into
  // `<head>` ahead of the chrome (prerendered static shell, flash-free, #187). See `sitePageThemeSeed`.
  const themeSeed = await sitePageThemeSeed("browse");
  const entries = await sanityFetch(INDEX_QUERY);

  // Empty-state guard keys off the RENDERED set, not the fetched set: notes are excluded from
  // KIND_SECTIONS, so `entries` can be non-empty yet nothing indexable renders (e.g. a garden
  // that is only notes). Guarding on the fetched length would strand the reader on a bare
  // header — so guard on whether any entry belongs to a rendered kind.
  const hasVisibleEntries = entries.some((entry) =>
    KIND_SECTIONS.some((section) => section.kind === entry.kind),
  );

  return (
    <>
      <PageTheme seed={themeSeed} />
      <Page width="page">
        <Stack gap={space(8)}>
          <Stack asChild gap={space(2)}>
            <header>
              <Heading level={1}>Index</Heading>
              <Text
                variant="lead"
                color="muted-foreground"
                className={styles.intro}
              >
                Everything in the garden — projects, essays, and now-updates.
              </Text>
            </header>
          </Stack>
          {!hasVisibleEntries ? (
            <Text variant="lead" color="muted-foreground">
              Nothing published yet.
            </Text>
          ) : (
            KIND_SECTIONS.map(({ kind, label }) => {
              const inKind = entries.filter((entry) => entry.kind === kind);
              if (inKind.length === 0) return null;
              return (
                <Stack asChild gap={space(4)} key={kind}>
                  <section aria-labelledby={`section-${kind}`}>
                    <Heading
                      level={2}
                      variant="label"
                      color="muted-foreground"
                      id={`section-${kind}`}
                      className={styles.sectionHeading}
                    >
                      {label}
                    </Heading>
                    <Stack asChild gap={space(5)}>
                      <ul className={styles.list}>
                        {inKind.map((entry) => (
                          <EntrySummary
                            key={entry._id}
                            title={entry.title ?? "Untitled entry"}
                            slug={entry.slug}
                            blurb={entry.blurb}
                            stage={entry.stage}
                            linkCount={entry.linkCount}
                          />
                        ))}
                      </ul>
                    </Stack>
                  </section>
                </Stack>
              );
            })
          )}
        </Stack>
      </Page>
    </>
  );
}
