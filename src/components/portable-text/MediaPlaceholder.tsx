import { AspectRatio } from "radix-ui";

import styles from "./MediaPlaceholder.module.css";
import { firstNonEmpty, isNonBlank } from "./mediaLabel";

interface MediaPlaceholderProps {
  /** Ordered label candidates; the first non-empty one names the box for assistive tech. */
  labelCandidates: Array<string | undefined>;
  /** Generic accessible name when every candidate is empty/absent (e.g. "Figure", "Video"). */
  fallbackLabel: string;
  /** Optional visible caption → `<figcaption>` (empty/whitespace-only ignored). */
  caption?: string;
  /** Optional aspect ratio (e.g. `16 / 9`); omitted → a min-height box for variable-ratio media. */
  ratio?: number;
}

/**
 * The shared placeholder for a deferred-media block (`figure`, `video`).
 *
 * This is the ONE place the media placeholder's accessibility-bearing markup lives, so it
 * can't drift per block: the `role="img"` box's accessible name is resolved through
 * `firstNonEmpty`, which treats an empty or whitespace-only candidate as absent — the guard
 * against the `?? "label"` footgun that would leave a blank accessible name (WCAG 2.2 SC
 * 1.1.1). A caller passes candidates + a fallback and CANNOT produce a blank name; the
 * resolver is an internal detail, not an API to remember. `ratio` holds the box in a Radix
 * AspectRatio (16:9 for video, so the eventual embed lands without layout shift — #128); omit
 * it for variable-ratio media (an image), which gets the min-height box. Var-consuming, themed
 * by the surrounding entry scope.
 */
export default function MediaPlaceholder({
  labelCandidates,
  fallbackLabel,
  caption,
  ratio,
}: MediaPlaceholderProps) {
  // The fallback is checked like any candidate (an empty `fallbackLabel` must not sneak a blank
  // name through), and a constant backstops even that — a `role="img"` can NEVER end up with a
  // blank accessible name (WCAG 2.2 SC 1.1.1), whatever the caller passes.
  const label = firstNonEmpty([...labelCandidates, fallbackLabel]) ?? "Media";
  const labelSpan = <span className={styles.label}>{label}</span>;
  return (
    <figure className={styles.figure}>
      {ratio ? (
        <AspectRatio.Root
          ratio={ratio}
          className={styles.box}
          role="img"
          aria-label={label}
        >
          {labelSpan}
        </AspectRatio.Root>
      ) : (
        <div className={styles.box} role="img" aria-label={label}>
          {labelSpan}
        </div>
      )}
      {isNonBlank(caption) ? (
        <figcaption className={styles.caption}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}
