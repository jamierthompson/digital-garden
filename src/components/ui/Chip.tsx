"use client";

import styles from "./Chip.module.css";

interface ChipProps {
  /** Toggle state, exposed as `aria-pressed`. */
  readonly pressed: boolean;
  readonly onClick: () => void;
  /** Optional leading swatch color (any CSS color string). */
  readonly swatch?: string;
  readonly children: React.ReactNode;
}

/**
 * A pressable pill chip — a toggle button with an optional leading color swatch (preset
 * pickers, filter chips). Generic UI primitive: reads the ambient semantic tokens; the
 * pressed state rings with the ambient accent. ≥24px target (WCAG 2.5.8).
 */
export default function Chip({
  pressed,
  onClick,
  swatch,
  children,
}: ChipProps): React.ReactElement {
  return (
    <button
      type="button"
      className={styles.chip}
      onClick={onClick}
      aria-pressed={pressed}
    >
      {swatch ? (
        <span
          className={styles.swatch}
          style={{ background: swatch }}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}
