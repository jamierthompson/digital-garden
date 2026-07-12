import { AspectRatio } from "radix-ui";

import styles from "./EntryVideo.module.css";
import { firstNonEmpty } from "./mediaLabel";

interface VideoValue {
  url?: string;
  caption?: string;
}

/**
 * The typed `video` editorial block.
 *
 * Renders a labelled placeholder + caption rather than standing up a provider/embed pipeline
 * before any project needs one — the same "name the destination, instantiate late" discipline
 * as EntryFigure (a real embed is deferred; see #128). The placeholder holds a Radix
 * AspectRatio 16:9 box, so it is video-shaped now and the eventual embed swaps in without a
 * layout shift (CLS). Total at the seam: a `video` with no URL still renders the placeholder
 * instead of crashing the article. Var-consuming, themed by the surrounding entry scope.
 */
export default function EntryVideo({ value }: { value: VideoValue }) {
  const label = firstNonEmpty([value.caption], "Video");
  return (
    <figure className={styles.video}>
      <AspectRatio.Root
        ratio={16 / 9}
        className={styles.placeholder}
        role="img"
        aria-label={label}
      >
        <span className={styles.placeholderText}>{label}</span>
      </AspectRatio.Root>
      {value.caption ? (
        <figcaption className={styles.caption}>{value.caption}</figcaption>
      ) : null}
    </figure>
  );
}
