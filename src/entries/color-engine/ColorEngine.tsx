import Heading from "@/components/typography/Heading";
import Text from "@/components/typography/Text";

import styles from "./ColorEngine.module.css";

/**
 * The Color Engine entry's interactive surface, shared by its after-prose `Slot` and every
 * `slot` block (`slots/*`). It takes no props — it ignores `slug` and slot context.
 *
 * Standing in for the module while it's rebuilt, it renders a small TYPE SPECIMEN through the
 * `Heading`/`Text` primitives — each role reads a semantic `--type-*-family` token that resolves
 * to `--font-heading`/`--font-body`/`--font-mono`, so the entry's three authored faces (which the
 * enclosing `[data-entry]` scope re-binds) all show through with no bespoke font-family here.
 */
export default function ColorEngine(): React.ReactElement {
  return (
    <div className={styles.specimen}>
      <Text variant="label" className={styles.muted}>
        Type specimen
      </Text>
      {/* Heading face — display / subheading / label all read --font-heading. */}
      <Heading level={2} variant="display">
        The Color Engine is being rebuilt.
      </Heading>
      <Heading level={3} variant="subheading">
        Meanwhile, a specimen of this entry&rsquo;s type.
      </Heading>
      {/* Body face — lede + running copy read --font-body. */}
      <Text variant="lede">
        This slot wears the entry&rsquo;s theme: its heading, body, and mono
        faces on the shared type scale.
      </Text>
      <Text>
        Headings and labels take the heading face; running copy like this takes
        the body face; metadata takes the mono face. Each role reads a semantic
        token, so the entry&rsquo;s authored fonts flow through without a single
        bespoke font-family.
      </Text>
      {/* Mono face — meta reads --font-mono. */}
      <Text variant="meta" className={styles.muted}>
        heading &middot; body &middot; mono &mdash; three roles, one entry theme
      </Text>
    </div>
  );
}
