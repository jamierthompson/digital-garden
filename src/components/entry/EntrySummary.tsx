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
 * the `/now` stream): linked title, summary, and the shared `EntryMeta` readout
 * (`stage · tended · N linked`), each rendered only when its field is present. Editorial
 * ink only (the themed card treatment is `EntryCard`'s); composed from the primitives, so
 * the structure is fixed here and a design pass is token/value tweaks.
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
        <Heading level={3}>
          {slug ? (
            <TextLink variant="quiet" asChild>
              <Link href={`/${slug}`}>{title}</Link>
            </TextLink>
          ) : (
            title
          )}
        </Heading>
        {summary ? (
          <Text color="muted-foreground" className={styles.summary}>
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
