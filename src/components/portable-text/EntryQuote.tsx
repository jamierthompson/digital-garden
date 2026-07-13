import Text from "@/components/typography/Text";

import styles from "./EntryQuote.module.css";

interface QuoteValue {
  text?: string;
  attribution?: string;
}

/**
 * The typed `quote` editorial block — a structured pull-quote.
 *
 * Distinct from the inline `blockquote` text style (a styled prose paragraph): a first-class
 * block carrying the quoted text plus an optional attribution, rendered as a semantic
 * <blockquote>/<cite>. Type comes from the `Text` primitive — the `quote` role for the body,
 * `caption` for the attribution — so the role bundles live in one place, not re-declared here.
 * Renders nothing when the quote text is absent (content can drift from the schema's required
 * field via a raw API write) — an empty <blockquote> would be noise.
 */
export default function EntryQuote({ value }: { value: QuoteValue }) {
  if (!value.text) {
    return null;
  }
  return (
    <blockquote className={styles.quote}>
      <Text variant="quote" asChild>
        <p className={styles.text}>{value.text}</p>
      </Text>
      {value.attribution ? (
        <Text variant="caption" asChild>
          <cite className={styles.attribution}>{value.attribution}</cite>
        </Text>
      ) : null}
    </blockquote>
  );
}
