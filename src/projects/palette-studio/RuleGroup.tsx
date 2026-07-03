// One rule group: a mono kicker label, a segmented pill control, and a live one-line
// consequence showing the active choice's plain-English effect. A thin composition of the
// ui/ primitives (Kicker + SegmentedControl + Note) — generic over the rule's string union
// so distribution, chroma, hue, and gamut all share it.

import Kicker from "@/components/ui/Kicker";
import Note from "@/components/ui/Note";
import SegmentedControl from "@/components/ui/SegmentedControl";

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
      <Kicker id={labelId}>{label}</Kicker>
      <SegmentedControl
        labelledBy={labelId}
        value={value}
        onValueChange={onValueChange}
        options={options}
      />
      {hint ? <Note>{hint}</Note> : null}
    </div>
  );
}
