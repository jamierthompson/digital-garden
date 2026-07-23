import EntryMeta from "@/components/entry/EntryMeta";
import EntryTeaser from "@/components/entry/EntryTeaser";
import Stack from "@/components/layout/Stack";
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
 * the `/now` stream): the shared `EntryTeaser` (title fused with its summary, linking to the
 * flat `/[slug]`) over the shared `EntryMeta` readout (`stage · tended · N related`), each
 * rendered only when its field is present. Editorial ink only (the themed card treatment is
 * `EntryCard`'s); the teaser's measure is capped here so the paragraph stays a readable line.
 */
export default function EntrySummary({
  title,
  slug,
  summary,
  stage,
  tended,
  linkCount,
}: EntrySummaryProps): React.ReactElement {
  return (
    <Stack asChild gap={space(2)}>
      <li>
        <EntryTeaser
          title={title}
          summary={summary}
          slug={slug}
          level={3}
          className={styles.teaser}
        />
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
