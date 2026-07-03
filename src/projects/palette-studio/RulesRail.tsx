// The left rules rail — the five generative-rule controls, opinionated defaults ON so the
// tool is usable in zero clicks. Four are segmented RadioGroups (RuleGroup); tinted-neutrals
// is a Radix Switch. Each carries a live plain-English consequence line. The rail themes off
// the ambient ProjectScope tokens; it only sets rule state, never any generated color.

import { Switch } from "radix-ui";

import type { Gamut } from "@garden/oklch";

import RuleGroup from "./RuleGroup";
import type { StudioRules } from "./rules";
import {
  CHROMA_OPTIONS,
  DISTRIBUTION_OPTIONS,
  GAMUT_OPTIONS,
  HUE_OPTIONS,
  TINTED_NEUTRALS_HINT,
} from "./ruleOptions";
import styles from "./RulesRail.module.css";

interface RulesRailProps {
  /** Slug-derived id namespace, threaded to each labelled control. */
  readonly idPrefix: string;
  readonly rules: StudioRules;
  readonly gamut: Gamut;
  /** Merge a partial rule change into the current rules. */
  readonly onRulesChange: (patch: Partial<StudioRules>) => void;
  readonly onGamutChange: (gamut: Gamut) => void;
}

export default function RulesRail({
  idPrefix,
  rules,
  gamut,
  onRulesChange,
  onGamutChange,
}: RulesRailProps): React.ReactElement {
  const tintedLabelId = `${idPrefix}-tinted-label`;
  const tintedHint = rules.tintedNeutrals
    ? TINTED_NEUTRALS_HINT.on
    : TINTED_NEUTRALS_HINT.off;
  return (
    <aside className={styles.rail} aria-label="Palette rules">
      <p className={styles.intro}>
        Rules shape the ramp before the tokens bind to it. Every default is on —
        the palette is legible before you touch a thing.
      </p>

      <RuleGroup
        label="Distribution"
        name="distribution"
        idPrefix={idPrefix}
        options={DISTRIBUTION_OPTIONS}
        value={rules.distribution}
        onValueChange={(distribution) => onRulesChange({ distribution })}
      />
      <RuleGroup
        label="Chroma"
        name="chroma"
        idPrefix={idPrefix}
        options={CHROMA_OPTIONS}
        value={rules.chromaPolicy}
        onValueChange={(chromaPolicy) => onRulesChange({ chromaPolicy })}
      />
      <RuleGroup
        label="Hue drift"
        name="hue"
        idPrefix={idPrefix}
        options={HUE_OPTIONS}
        value={rules.huePolicy}
        onValueChange={(huePolicy) => onRulesChange({ huePolicy })}
      />

      <div className={styles.group}>
        <span id={tintedLabelId} className={styles.label}>
          Tinted neutrals
        </span>
        <div className={styles.switchRow}>
          <Switch.Root
            className={styles.switch}
            aria-labelledby={tintedLabelId}
            checked={rules.tintedNeutrals}
            onCheckedChange={(tintedNeutrals) =>
              onRulesChange({ tintedNeutrals })
            }
          >
            <Switch.Thumb className={styles.thumb} />
          </Switch.Root>
          <span className={styles.switchState}>
            {rules.tintedNeutrals ? "on" : "off"}
          </span>
        </div>
        <p className={styles.hint}>{tintedHint}</p>
      </div>

      <RuleGroup
        label="Gamut"
        name="gamut"
        idPrefix={idPrefix}
        options={GAMUT_OPTIONS}
        value={gamut}
        onValueChange={onGamutChange}
      />
    </aside>
  );
}
