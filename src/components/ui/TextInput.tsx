import type { ComponentPropsWithoutRef } from "react";

import styles from "./TextInput.module.css";

type TextInputProps = Omit<ComponentPropsWithoutRef<"input">, "className"> & {
  /** Code voice — monospace face for machine-ish values (colors, ids, tokens). */
  readonly mono?: boolean;
};

/**
 * A text input field. Generic UI primitive: hairline field on the ambient semantic
 * tokens, with `aria-invalid` ringing the engine-solved `--error`. Native input
 * attributes pass through (`value`, `onChange`, `aria-*`, `placeholder`, …) — the
 * consumer owns wiring and labelling (pair with `Kicker htmlFor`).
 */
export default function TextInput({
  mono,
  ...props
}: TextInputProps): React.ReactElement {
  return (
    <input
      className={mono ? `${styles.input} ${styles.mono}` : styles.input}
      {...props}
    />
  );
}
