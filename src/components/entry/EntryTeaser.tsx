import Link from "next/link";

import Heading, { type HeadingLevel } from "@/components/typography/Heading";
import Text from "@/components/typography/Text";
import TextLink, { type TextLinkVariant } from "@/components/ui/TextLink";

import styles from "./EntryTeaser.module.css";

interface EntryTeaserProps {
  /** The entry title — the emphasized run-in that opens the paragraph. Blank/whitespace resolves
   *  to a neutral fallback so a card never renders a nameless heading. */
  readonly title: string | null;
  /** The summary continuing the paragraph after the title. Omitted → the run-in stands alone. */
  readonly summary?: string | null;
  /** Links the title to the flat `/[slug]`; absent → the title renders as plain text, never a
   *  dead link. */
  readonly slug?: string | null;
  /** The title's heading level → the rendered `<hN>` and its place in the document outline
   *  (`3` on the list/teaser surfaces, `1` on a demo detail header). */
  readonly level: HeadingLevel;
  /** The title link's treatment when linked — defaults to `quiet` (a heading/title link). */
  readonly linkVariant?: TextLinkVariant;
  /** Lands on the root element — the hook a surface uses to tune the paragraph (RelatedEntries'
   *  summary line-clamp is applied this way, so the atom itself stays trim-agnostic). */
  readonly className?: string;
}

/**
 * The fused **title + summary** paragraph — the single title-and-summary renderer for every
 * surface that shows both (home cards, `/browse`, `/now`, the Related list, and the demo detail
 * header). The title is a real heading kept in the document outline but rendered as an inline
 * **run-in**, so the summary continues it as one paragraph rather than sitting under a separate
 * heading — the shape the sentence-title copy is written for (titles carry their own terminal
 * punctuation; the summary continues the claim).
 *
 * It owns only the fused paragraph: type and ink come from the composed `Heading`/`Text` role
 * primitives, and each surface keeps its own wrapper, meta readout (`EntryMeta`), and styling.
 * Polymorphic on the two things that genuinely differ between surfaces — the heading `level` and
 * whether the title links — never a per-surface `variant`.
 */
export default function EntryTeaser({
  title,
  summary,
  slug,
  level,
  linkVariant = "quiet",
  className,
}: EntryTeaserProps): React.ReactElement {
  // Nullish-coalescing isn't enough: a blank Studio field serialises to "" (a valid string), which
  // would render an empty heading — a nameless node in the outline, and a link whose accessible
  // name silently degrades to the summary. Treat blank/whitespace-only as missing.
  const displayTitle = title?.trim() ? title : "Untitled entry";

  // Same blank/whitespace guard as the title: a whitespace-only `slug.current` (hand-editable in
  // the Studio) is treated as absent so it renders plain text, never a dead `href="/   "`. The
  // trimmed value drives the href too, so a padded slug routes to the clean path.
  const linkSlug = slug?.trim();

  const titleContent = linkSlug ? (
    <TextLink variant={linkVariant} asChild>
      <Link href={`/${linkSlug}`}>{displayTitle}</Link>
    </TextLink>
  ) : (
    displayTitle
  );

  return (
    <div className={[styles.teaser, className].filter(Boolean).join(" ")}>
      <Heading
        level={level}
        variant="body"
        color="foreground"
        className={styles.title}
      >
        {/* The emphasis lives on an inner span, never on the heading itself, so the
            run-in flip can't collide with the `body` role's own font-weight. */}
        <span className={styles.emphasis}>{titleContent}</span>
      </Heading>
      {summary?.trim() ? (
        <>
          {/* A real space between the inline run-in and the summary, so the two flow as one
              paragraph and copy-paste keeps the word break. Guarded on `.trim()` (not bare
              truthiness) so a whitespace-only field adds neither the space nor an empty node. */}{" "}
          <Text variant="body" color="muted-foreground" asChild>
            <span>{summary}</span>
          </Text>
        </>
      ) : null}
    </div>
  );
}
