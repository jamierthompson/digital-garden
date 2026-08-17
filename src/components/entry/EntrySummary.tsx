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
 * rows can be restyled without moving the home cards or the Related list with them. The title
 * arrives already resolved — each stream words its own fallback ("Untitled entry" on the Index,
 * "Untitled update" on `/now`) — so there is nothing to fall back to here.
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
      <li className={styles.entry}>
        <Heading level={3} color="foreground">
          {slug ? (
            <TextLink variant="quiet" asChild>
              <Link href={`/${slug}`}>{title}</Link>
            </TextLink>
          ) : (
            title
          )}
        </Heading>
        {summary ? (
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
