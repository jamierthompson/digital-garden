// One rule group in the left rail: a mono kicker label, a segmented Radix RadioGroup of
// pills (roving-focus, fully keyboard-operable), and a live one-line consequence showing the
// active choice's plain-English effect. Generic over the rule's string union so distribution,
// chroma, hue, and gamut all share it — the four are the same control shape.

import { RadioGroup } from "radix-ui";

import type { RuleOption } from "./ruleOptions";
import styles from "./RuleGroup.module.css";

interface RuleGroupProps<T extends string> {
  /** Kicker label, e.g. "DISTRIBUTION". */
  readonly label: string;
  /** Stable id stem for wiring the group label to the radio group. */
  readonly name: string;
  /** Slug-derived id namespace so labels don't collide across Activity-preserved mounts. */
  readonly idPrefix: string;
  readonly options: readonly RuleOption<T>[];
  readonly value: T;
  readonly onValueChange: (value: T) => void;
}

export default function RuleGroup<T extends string>({
  label,
  name,
  idPrefix,
  options,
  value,
  onValueChange,
}: RuleGroupProps<T>): React.ReactElement {
  const labelId = `${idPrefix}-${name}-label`;
  const hint = options.find((o) => o.value === value)?.hint;
  return (
    <div className={styles.group}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <RadioGroup.Root
        className={styles.options}
        aria-labelledby={labelId}
        value={value}
        onValueChange={(v) => onValueChange(v as T)}
        orientation="horizontal"
      >
        {options.map((opt) => (
          <RadioGroup.Item
            key={opt.value}
            className={styles.pill}
            value={opt.value}
          >
            {opt.label}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
