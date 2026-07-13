import type { CSSProperties } from "react";

import Text from "@/components/typography/Text";

import styles from "./MediaPlaceholder.module.css";
import { firstNonEmpty, isNonBlank } from "./mediaLabel";

interface MediaPlaceholderProps {
  /**
   * Ordered candidates for the box's accessible name (e.g. an image's `alt`) — the FIRST
   * non-blank one wins. Do NOT pass the caption here: it already shows in the `<figcaption>`,
   * and repeating it as the accessible name is the alt-duplicates-caption anti-pattern.
   */
  labelCandidates: Array<string | undefined>;
  /** The media kind — the visible chip AND the accessible-name fallback (e.g. "Figure", "Video"). */
  fallbackLabel: string;
  /** Optional visible caption → `<figcaption>` (empty/whitespace-only ignored). */
  caption?: string;
  /** Optional CSS aspect-ratio (e.g. `"16 / 9"`); omitted → a min-height box for variable-ratio media. */
  ratio?: string;
}

/**
 * The shared placeholder for a deferred-media block (`figure`, `video`).
 *
 * This is the ONE place the media placeholder's accessibility-bearing markup lives, so it can't
 * drift per block. Two distinct labels: the visible chip always names the media KIND ("Video"),
 * while the box's accessible name is the first non-blank descriptor, falling back to the kind —
 * so an authored caption shows once (as the `<figcaption>`), never doubled into the box. Both the
 * name and the caption pass through `isNonBlank`, which treats an empty or whitespace-only string
 * as absent: the guard against the `?? "label"` footgun that would leave a blank accessible name
 * (WCAG 2.2 SC 1.1.1). A constant backstops the name, so no input can blank it. `ratio` gives the
 * box a native CSS `aspect-ratio` (16:9 for video, so the eventual embed lands without layout
 * shift — #128); omit it for variable-ratio media (an image), which gets the min-height box.
 * Var-consuming, themed by the surrounding entry scope.
 */
export default function MediaPlaceholder({
  labelCandidates,
  fallbackLabel,
  caption,
  ratio,
}: MediaPlaceholderProps) {
  // Accessible name: first non-blank descriptor, then the kind, backstopped by a constant — a
  // `role="img"` can NEVER end up with a blank accessible name (WCAG 2.2 SC 1.1.1).
  const accessibleName =
    firstNonEmpty([...labelCandidates, fallbackLabel]) ?? "Media";
  // Visible chip: the media kind, never blank.
  const kind = isNonBlank(fallbackLabel) ? fallbackLabel : "Media";
  // The ratio is parameterized as a custom property consumed by `.box` in the module, so the
  // aspect-ratio declaration lives in the CSS layer (not an inline layout value).
  const boxStyle = ratio
    ? ({ "--placeholder-ratio": ratio } as CSSProperties)
    : undefined;
  return (
    <figure className={styles.figure}>
      <div
        className={styles.box}
        role="img"
        aria-label={accessibleName}
        style={boxStyle}
      >
        <Text variant="caption" asChild>
          <span className={styles.label}>{kind}</span>
        </Text>
      </div>
      {isNonBlank(caption) ? (
        <Text variant="caption" asChild>
          <figcaption className={styles.caption}>{caption}</figcaption>
        </Text>
      ) : null}
    </figure>
  );
}
