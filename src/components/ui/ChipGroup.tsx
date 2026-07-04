"use client";

import { ToggleGroup } from "radix-ui";

import styles from "./ChipGroup.module.css";

/** One selectable chip. */
export interface ChipOption {
  readonly value: string;
  readonly label: string;
  /** Optional leading swatch color (any CSS color string), hidden from AT. */
  readonly swatch?: string;
}

interface ChipGroupProps {
  /** Accessible name for the group. */
  readonly label: string;
  /** The selected option's value, or `""` when none is selected. */
  readonly value: string;
  /**
   * Fires with the picked value — or `""` when the selected chip is clicked again
   * (Radix single-type deselection); ignore that if deselection is meaningless.
   */
  readonly onValueChange: (value: string) => void;
  readonly options: readonly ChipOption[];
}

/**
 * A single-select pill-chip group (Radix `ToggleGroup type="single"`): one Tab stop with
 * roving arrow-key focus, `role="radiogroup"`/`radio` + `aria-checked` semantics from
 * Radix. Generic UI primitive: reads the ambient semantic tokens; the selected chip rings
 * with the ambient accent. ≥24px targets (WCAG 2.5.8).
 */
export default function ChipGroup({
  label,
  value,
  onValueChange,
  options,
}: ChipGroupProps): React.ReactElement {
  return (
    <ToggleGroup.Root
      type="single"
      className={styles.group}
      aria-label={label}
      value={value}
      onValueChange={onValueChange}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          className={styles.chip}
          value={option.value}
        >
          {option.swatch ? (
            <span
              className={styles.swatch}
              style={{ background: option.swatch }}
              aria-hidden="true"
            />
          ) : null}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
