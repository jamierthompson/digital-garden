import MediaPlaceholder from "./MediaPlaceholder";

interface VideoValue {
  url?: string;
  caption?: string;
}

/**
 * The typed `video` editorial block — a referenced video (URL + optional caption).
 *
 * The real embed is deferred (#128), so it renders the shared `MediaPlaceholder` in a 16:9
 * AspectRatio box: video-shaped now, and the eventual embed lands without layout shift. The
 * caption names the box (a generic label otherwise) and shows beneath. Total at the seam — a
 * `video` with no URL still renders the placeholder rather than crashing the article.
 */
export default function EntryVideo({ value }: { value: VideoValue }) {
  return (
    <MediaPlaceholder
      labelCandidates={[value.caption]}
      fallbackLabel="Video"
      caption={value.caption}
      ratio={16 / 9}
    />
  );
}
