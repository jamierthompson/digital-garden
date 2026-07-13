import MediaPlaceholder from "./MediaPlaceholder";

interface FigureValue {
  alt?: string;
  caption?: string;
  asset?: { _ref?: string };
}

/**
 * The typed `figure` editorial block — an editor-picked image with required alt + optional
 * caption.
 *
 * Rather than stand up a Sanity image-URL builder before any project needs one (the "name the
 * destination, instantiate late" discipline), it renders the shared `MediaPlaceholder`: the
 * `alt` names the box for assistive tech (with the caption, then a generic label, as
 * fallbacks) and the caption shows beneath. An image has no fixed aspect ratio, so no `ratio`
 * is passed.
 */
export default function EntryFigure({ value }: { value: FigureValue }) {
  return (
    <MediaPlaceholder
      labelCandidates={[value.alt, value.caption]}
      fallbackLabel="Figure"
      caption={value.caption}
    />
  );
}
