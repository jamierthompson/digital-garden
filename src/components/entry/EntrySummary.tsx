import Link from "next/link";

import Cluster from "@/components/layout/Cluster";
import Stack from "@/components/layout/Stack";
import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import { space } from "@/lib/tokens";

import styles from "./EntrySummary.module.css";

interface EntrySummaryProps {
  /** The display title — already fallback-resolved by the caller (`?? "Untitled …"`). */
  readonly title: string;
  /** Links the title to the flat `/[slug]`; absent → the title renders as plain text. */
  readonly slug?: string | null;
  readonly blurb?: string | null;
  /** The maturity badge, rendered beside the title (also stamped as `data-stage`). */
  readonly stage?: string | null;
  /** A dated stream's kicker — the machine value for `<time>` plus its display label. */
  readonly date?: { readonly dateTime: string; readonly label: string } | null;
  /** Backlink hint — rendered only when positive. */
  readonly linkCount?: number | null;
}

/**
 * One entry in an editorial list — a `<li>` for the summary streams (the Index's sections,
 * the `/now` stream): date kicker, linked title with the optional `stage` badge, blurb, and
 * the backlink hint, each rendered only when its field is present. Editorial ink only (the
 * themed card treatment is `EntryCard`'s); composed from the primitives, so the structure is
 * fixed here and a design pass is token/value tweaks.
 */
export default function EntrySummary({
  title,
  slug,
  blurb,
  stage,
  date,
  linkCount,
}: EntrySummaryProps): React.ReactElement {
  return (
    <Stack asChild gap={space(2)}>
      <li>
        {date ? (
          <Text variant="meta" color="muted-foreground" asChild>
            <time className={styles.date} dateTime={date.dateTime}>
              {date.label}
            </time>
          </Text>
        ) : null}
        <Cluster asChild>
          <div className={styles.head}>
            <Heading level={3}>
              {slug ? (
                <Link href={`/${slug}`} className={styles.titleLink}>
                  {title}
                </Link>
              ) : (
                <span className={styles.titleLink}>{title}</span>
              )}
            </Heading>
            {stage ? (
              <Text variant="meta" color="muted-foreground" asChild>
                <span className={styles.stage} data-stage={stage}>
                  {stage}
                </span>
              </Text>
            ) : null}
          </div>
        </Cluster>
        {blurb ? (
          <Text color="muted-foreground" className={styles.blurb}>
            {blurb}
          </Text>
        ) : null}
        {(linkCount ?? 0) > 0 ? (
          <Text variant="meta" color="muted-foreground" asChild>
            <span>{linkCount} linked</span>
          </Text>
        ) : null}
      </li>
    </Stack>
  );
}
