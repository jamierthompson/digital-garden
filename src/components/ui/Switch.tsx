"use client";

import { Switch as RadixSwitch } from "radix-ui";

import styles from "./Switch.module.css";

interface SwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /** Accessible name; omit when wired via `aria-labelledby`. */
  readonly label?: string;
  /** Id of the element that labels the switch. */
  readonly labelledBy?: string;
  readonly id?: string;
}

/**
 * A toggle switch (Radix `Switch` under the hood). Generic UI primitive: the off state
 * reads as a hairline pill, the on state fills with the ambient accent — editorial by
 * default, brand inside a brand slot. Provide `label` or `labelledBy`, not both.
 */
export default function Switch({
  checked,
  onCheckedChange,
  label,
  labelledBy,
  id,
}: SwitchProps): React.ReactElement {
  return (
    <RadixSwitch.Root
      className={styles.switch}
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      <RadixSwitch.Thumb className={styles.thumb} />
    </RadixSwitch.Root>
  );
}
