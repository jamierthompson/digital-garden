// The rules board — the five generative-rule controls, opinionated defaults ON so the
// tool is usable in zero clicks. Four are segmented pill groups (RuleGroup); tinted-neutrals
// is a Switch. Each carries a live plain-English consequence line (Note). Mounted full-width
// inside its slot Panel (#131); it only sets rule state, never any generated color.

import Kicker from "@/components/ui/Kicker";
import Note from "@/components/ui/Note";
import Switch from "@/components/ui/Switch";

import type { Gamut } from "@garden/oklch";

import RuleGroup from "./RuleGroup";
import type { StudioRules } from "../core/rules";
import {
  CHROMA_OPTIONS,
  DISTRIBUTION_OPTIONS,
  GAMUT_OPTIONS,
  HUE_OPTIONS,
  TINTED_NEUTRALS_HINT,
} from "../core/ruleOptions";
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
    <div className={styles.rail} role="group" aria-label="Palette rules">
      <Note>
        Rules shape the ramp before the tokens bind to it. Every default is on —
        the palette is legible before you touch a thing.
      </Note>

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
        <Kicker id={tintedLabelId}>Tinted neutrals</Kicker>
        <div className={styles.switchRow}>
          <Switch
            labelledBy={tintedLabelId}
            checked={rules.tintedNeutrals}
            onCheckedChange={(tintedNeutrals) =>
              onRulesChange({ tintedNeutrals })
            }
          />
          <span className={styles.switchState}>
            {rules.tintedNeutrals ? "on" : "off"}
          </span>
        </div>
        <Note>{tintedHint}</Note>
      </div>

      <RuleGroup
        label="Gamut"
        name="gamut"
        idPrefix={idPrefix}
        options={GAMUT_OPTIONS}
        value={gamut}
        onValueChange={onGamutChange}
      />
    </div>
  );
}
