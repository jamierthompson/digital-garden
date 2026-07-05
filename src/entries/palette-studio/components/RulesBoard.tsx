// The rules board — the five generative-rule controls, opinionated defaults ON so the
// tool is usable in zero clicks. Four are segmented pill groups (RuleGroup); tinted-neutrals
// is a Switch. Each carries a live plain-English consequence line (Note). Mounted full-width
// inside its slot Panel (#131); it only sets rule state, never any generated color.

import Kicker from "@/components/ui/Kicker";
import Aside from "@/components/ui/Aside";
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
import styles from "./RulesBoard.module.css";

interface RulesBoardProps {
  /** Slug-derived id namespace, threaded to each labelled control. */
  readonly idPrefix: string;
  readonly rules: StudioRules;
  readonly gamut: Gamut;
  /** Merge a partial rule change into the current rules. */
  readonly onRulesChange: (patch: Partial<StudioRules>) => void;
  readonly onGamutChange: (gamut: Gamut) => void;
}

export default function RulesBoard({
  idPrefix,
  rules,
  gamut,
  onRulesChange,
  onGamutChange,
}: RulesBoardProps): React.ReactElement {
  const tintedSwitchId = `${idPrefix}-tinted`;
  const tintedHint = rules.tintedNeutrals
    ? TINTED_NEUTRALS_HINT.on
    : TINTED_NEUTRALS_HINT.off;
  return (
    <div className={styles.board} role="group" aria-label="Palette rules">
      {/* No blurb — the owner authors the rules copy separately; the "Palette rules" group label
          names it until then. */}
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
        <Kicker htmlFor={tintedSwitchId}>Tinted neutrals</Kicker>
        <div className={styles.switchRow}>
          <Switch
            id={tintedSwitchId}
            checked={rules.tintedNeutrals}
            onCheckedChange={(tintedNeutrals) =>
              onRulesChange({ tintedNeutrals })
            }
          />
          <span className={styles.switchState}>
            {rules.tintedNeutrals ? "on" : "off"}
          </span>
        </div>
        <Aside>{tintedHint}</Aside>
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
