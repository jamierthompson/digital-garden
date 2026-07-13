import MediaPlaceholder from "./MediaPlaceholder";

interface VideoValue {
  url?: string;
  caption?: string;
}

/**
 * The typed `video` editorial block — a referenced video (URL + optional caption).
 *
 * The real embed is deferred (#263), so it renders the shared `MediaPlaceholder` in a 16:9 box
 * (native CSS `aspect-ratio`): video-shaped now, and the eventual embed lands without layout
 * shift. There is no descriptor besides the caption, so the box's accessible name is the generic
 * "Video"; the caption shows in the `<figcaption>` beneath. Total at the seam — a `video` with no
 * URL still renders the placeholder rather than crashing the article.
 */
export default function EntryVideo({ value }: { value: VideoValue }) {
  return (
    <MediaPlaceholder
      labelCandidates={[]}
      fallbackLabel="Video"
      caption={value.caption}
      ratio="16 / 9"
    />
  );
}
