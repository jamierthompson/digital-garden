import styles from "./EssayFigure.module.css";

interface FigureValue {
  alt?: string;
  caption?: string;
  asset?: { _ref?: string };
}

/**
 * The typed `figure` editorial block (§6, [D15, D24]).
 *
 * The essay schema allows a `figure` (editor-picked image, required alt + optional caption),
 * so the serializer must handle the type to stay total — a `figure` must not crash the
 * render. Rather than stand up a Sanity image-URL builder before any project needs one (the
 * "name the destination, instantiate late" discipline [D24]), this renders the authored alt
 * + caption as a labelled placeholder. Var-consuming, themed by the surrounding scope (§8).
 */
export default function EssayFigure({ value }: { value: FigureValue }) {
  const label = value.alt ?? value.caption ?? "Figure";
  return (
    <figure className={styles.figure}>
      <div className={styles.placeholder} role="img" aria-label={label}>
        <span className={styles.placeholderText}>{label}</span>
      </div>
      {value.caption ? (
        <figcaption className={styles.caption}>{value.caption}</figcaption>
      ) : null}
    </figure>
  );
}
