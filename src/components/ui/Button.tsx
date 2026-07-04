"use client";

import styles from "./Button.module.css";

interface ButtonProps {
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

/**
 * A pill action button. Generic UI primitive: hairline pill that reads the ambient
 * semantic tokens — editorial by default, brand inside a brand slot. Always
 * `type="button"` (no implicit form submission).
 */
export default function Button({
  onClick,
  children,
}: ButtonProps): React.ReactElement {
  return (
    <button type="button" className={styles.button} onClick={onClick}>
      {children}
    </button>
  );
}
