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
    "Every entry in the garden — demos, essays, and notes, browsable in one place.",
};

// The kinds in display order, with their section labels. A named constant so the order and
// wording live in one place, not as magic strings scattered through the render.
//
// `now` is deliberately absent: the dated stream is `/now`'s surface. INDEX_QUERY already
// filters it out, so this allowlist's remaining job is guarding against a kind the code
// doesn't recognize — a drifted row is dropped rather than rendered unlabeled.
const KIND_SECTIONS = [
  { kind: "demo", label: "Demos" },
  { kind: "essay", label: "Essays" },
  { kind: "note", label: "Notes" },
] as const;

/**
 * The `/browse` route (labelled "index" in the nav) — the browsable list of the garden's notes,
 * essays, and demos (the dated `now` stream is `/now`'s surface), the wanderer's reading path
 * (the featured home `/` is the hurried evaluator's). Shell-owned editorial chrome: it reads
 * the global semantic tokens, with NO per-entry theme (a demo's theme lives on its own
 * detail slot, not here). Groups entries by `kind` (see `KIND_SECTIONS`), gives each row the
 * shared `EntryMeta` readout (`stage · tended · N related` — no `kind`: the section heading
 * already says it), and links each to its flat `/[slug]`.
 */
export default async function IndexPage() {
  // Seed on the awaited path → synchronous `<PageTheme>`; its `:root` `<style>` hoists into
  // `<head>` ahead of the chrome (prerendered static shell, flash-free, #187). See `sitePageThemeSeed`.
  const themeSeed = await sitePageThemeSeed("browse");
  const entries = await sanityFetch(INDEX_QUERY);

  // Empty-state guard keys off the RENDERED set, not the fetched set: KIND_SECTIONS is an
  // allowlist, so `entries` can be non-empty yet nothing renders (every row carrying a kind the
  // code doesn't know). Guarding on the fetched length would strand the reader on a bare
  // header — so guard on whether any entry belongs to a rendered kind.
  const hasVisibleEntries = entries.some((entry) =>
    KIND_SECTIONS.some((section) => section.kind === entry.kind),
  );

  return (
    <>
      <PageTheme seed={themeSeed} />
      <Page>
        {/* The index listing runs wider than the reading measure — the whole page block takes
            the wide lane. */}
        <Stack gap={space(8)} className={styles.content}>
          <Stack asChild gap={space(2)}>
            <header>
              <Heading level={1}>Index</Heading>
              <Text
                variant="lede"
                color="muted-foreground"
                className={styles.intro}
              >
                Everything in the garden — demos, essays, and notes.
              </Text>
            </header>
          </Stack>
          {!hasVisibleEntries ? (
            <Text variant="lede" color="muted-foreground">
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
                            title={entry.title || "Untitled entry"}
                            slug={entry.slug}
                            summary={entry.summary}
                            stage={entry.stage}
                            tended={entry.tended}
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
