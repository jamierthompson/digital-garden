"use client";

import { RadioGroup } from "radix-ui";

import styles from "./SegmentedControl.module.css";

/** One selectable segment. */
export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Accessible name for the group — announced, not rendered. */
  readonly label: string;
  readonly value: T;
  readonly onValueChange: (value: T) => void;
  readonly options: readonly SegmentedOption<T>[];
}

/**
 * A pill segmented control — a horizontal single-choice toggle (Radix `RadioGroup`
 * under the hood, so roving arrow-key navigation and `aria-checked` come for free).
 * Generic UI primitive: themes off the ambient semantic tokens (`--accent`,
 * `--on-accent`, `--border`, …) so it reads editorial by default and brand inside a
 * project slot.
 */
export default function SegmentedControl<T extends string>({
  label,
  value,
  onValueChange,
  options,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <RadioGroup.Root
      className={styles.root}
      aria-label={label}
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      orientation="horizontal"
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          className={styles.pill}
          value={option.value}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
