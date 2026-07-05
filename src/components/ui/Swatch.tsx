import styles from "./Swatch.module.css";

interface SwatchProps {
  /** Any CSS color string — filled as the tile's background. */
  readonly color: string;
  /** Out-of-gamut marker (the chroma was trimmed to fit the target gamut). */
  readonly oog?: boolean;
  readonly className?: string;
}

/**
 * A plain color swatch tile — the site's shared swatch language. Decorative by default
 * (`aria-hidden`); the consumer owns any accessible name (a visible label, a radio's
 * text). Size comes from the consumer.
 */
export default function Swatch({
  color,
  oog = false,
  className,
}: SwatchProps): React.ReactElement {
  return (
    <span
      className={className ? `${styles.swatch} ${className}` : styles.swatch}
      aria-hidden="true"
    >
      <span className={styles.fill} style={{ background: color }} />
      {oog ? <span className={styles.oog} /> : null}
    </span>
  );
}
