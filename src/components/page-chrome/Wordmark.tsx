import Link from "next/link";

import TextLink from "@/components/ui/TextLink";

import styles from "./Wordmark.module.css";

/**
 * The `folio_` wordmark — the home link (`/`). The trailing `_` is a muted blinking-cursor
 * nod from the engineering-journal direction, decorative and hidden from AT. Ink is `ui/TextLink`'s
 * `brand` variant; this component owns only the wordmark type role and the cursor glyph.
 */
export default function Wordmark(): React.ReactElement {
  return (
    <TextLink variant="brand" asChild className={styles.wordmark}>
      <Link href="/">
        folio
        <span className={styles.cursor} aria-hidden="true">
          _
        </span>
      </Link>
    </TextLink>
  );
}
