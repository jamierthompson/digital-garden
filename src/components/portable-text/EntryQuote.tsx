import Text from "@/components/typography/Text";

import styles from "./EntryQuote.module.css";

interface QuoteValue {
  text?: string;
  attribution?: string;
}

/**
 * The typed `quote` editorial block — a structured pull-quote.
 *
 * Renders the shape the HTML spec blesses: a `<figure>` wraps a `<blockquote>` that carries ONLY
 * the quoted text, and — when attributed — a `<figcaption>` sits OUTSIDE the quote, because the
 * attribution is not part of what was quoted. The attribution is plain text, not `<cite>`: the
 * freeform field is usually a person, and `<cite>` is spec'd for the title of a work, not a name.
 * Type comes from the `Text` primitive — the `quote` role for the body, `caption` for the
 * attribution — so the role bundles live in one place, not re-declared here. Renders nothing when
 * the quote text is absent (content can drift from the schema's required field via a raw API
 * write) — an empty quote would be noise.
 */
export default function EntryQuote({ value }: { value: QuoteValue }) {
  if (!value.text) {
    return null;
  }
  return (
    <figure className={styles.quote}>
      <blockquote className={styles.blockquote}>
        <Text variant="quote" asChild>
          <p className={styles.text}>{value.text}</p>
        </Text>
      </blockquote>
      {value.attribution ? (
        <Text variant="caption" asChild>
          <figcaption className={styles.attribution}>
            {value.attribution}
          </figcaption>
        </Text>
      ) : null}
    </figure>
  );
}
