import Text from "@/components/typography/Text";

import styles from "./EntryQuote.module.css";
import { isNonBlank } from "./mediaLabel";

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
 * attribution — so the role bundles live in one place, not re-declared here. Both fields pass
 * through `isNonBlank`, the same total guard the media blocks use: content can drift from the
 * schema's required field via a raw API write (absent, whitespace-only, or a non-string shape),
 * and each counts as absent — so an empty or whitespace-only quote renders nothing (noise), and a
 * drifted non-string degrades rather than reaching React children (an object child would crash the
 * article). The `<figcaption>` renders only when the attribution is itself a real string.
 */
export default function EntryQuote({ value }: { value: QuoteValue }) {
  if (!isNonBlank(value.text)) {
    return null;
  }
  return (
    <figure className={styles.quote}>
      <blockquote className={styles.blockquote}>
        <Text variant="quote" asChild>
          <p className={styles.text}>{value.text}</p>
        </Text>
      </blockquote>
      {isNonBlank(value.attribution) ? (
        <Text variant="caption" asChild>
          <figcaption className={styles.attribution}>
            {value.attribution}
          </figcaption>
        </Text>
      ) : null}
    </figure>
  );
}
