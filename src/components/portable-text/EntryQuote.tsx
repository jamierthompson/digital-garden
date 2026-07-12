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
 * <blockquote> with a <cite>. Renders nothing when the quote text is absent (content can
 * drift from the schema's required field via a raw API write) — an empty <blockquote> would
 * be noise. Var-consuming, themed by the surrounding entry scope.
 */
export default function EntryQuote({ value }: { value: QuoteValue }) {
  if (!value.text) {
    return null;
  }
  return (
    <blockquote className={styles.quote}>
      <p className={styles.text}>{value.text}</p>
      {value.attribution ? (
        <cite className={styles.attribution}>{value.attribution}</cite>
      ) : null}
    </blockquote>
  );
}
