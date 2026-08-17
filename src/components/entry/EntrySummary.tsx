import Link from "next/link";

import EntryMeta from "@/components/entry/EntryMeta";
import Stack from "@/components/layout/Stack";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import TextLink from "@/components/ui/TextLink";
import { space } from "@/lib/tokens";

import styles from "./EntrySummary.module.css";

interface EntrySummaryProps {
  /** The display title — already fallback-resolved by the caller (`?? "Untitled …"`). */
  readonly title: string;
  /** Links the title to the flat `/[slug]`; absent → the title renders as plain text. */
  readonly slug?: string | null;
  readonly summary?: string | null;
  readonly stage?: string | null;
  /** The authored last-tended date (ISO `YYYY-MM-DD`), for the meta readout. */
  readonly tended?: string | null;
  /** Backlink hint — rendered only when positive. */
  readonly linkCount?: number | null;
}

/**
 * One entry in an editorial list — a `<li>` for the summary streams (the Index's sections,
 * the `/now` stream): the title as a real `<h3>` linking to the flat `/[slug]`, over its summary
 * paragraph, over the shared `EntryMeta` readout (`stage · tended · N related`), each rendered
 * only when its field is present. Editorial ink only (the themed card treatment is `EntryCard`'s);
 * the row's measure is capped here so the summary stays a readable line.
 *
 * The title + summary markup is this component's own rather than a shared atom's, so the Index
 * rows can be restyled without moving the home cards or the Related list with them.
 */
export default function EntrySummary({
  title,
  slug,
  summary,
  stage,
  tended,
  linkCount,
}: EntrySummaryProps): React.ReactElement {
  // The callers resolve a NULLISH title, which leaves the blank case: a cleared Studio field
  // serialises to "" (a valid string) and slips past `??`, rendering a nameless heading whose
  // link would take its accessible name from nothing. Treat blank/whitespace-only as missing.
  const displayTitle = title?.trim() ? title : "Untitled entry";

  // A whitespace-only `slug.current` (hand-editable in the Studio) is treated as absent so the
  // title renders plain text, never a dead `href="/   "`. The trimmed value drives the href too,
  // so a padded slug still routes to the clean path.
  const linkSlug = slug?.trim();

  return (
    <Stack asChild gap={space(2)}>
      <li className={styles.entry}>
        <Heading level={3} color="foreground">
          {linkSlug ? (
            <TextLink variant="quiet" asChild>
              <Link href={`/${linkSlug}`}>{displayTitle}</Link>
            </TextLink>
          ) : (
            displayTitle
          )}
        </Heading>
        {/* Guarded on `.trim()` (not bare truthiness) so a whitespace-only field renders no
            paragraph at all rather than an empty node taking the stack's gap. */}
        {summary?.trim() ? (
          <Text variant="body" color="muted-foreground">
            {summary}
          </Text>
        ) : null}
        <EntryMeta
          stage={stage}
          tended={tended}
          linkCount={linkCount}
          color="muted-foreground"
        />
      </li>
    </Stack>
  );
}
