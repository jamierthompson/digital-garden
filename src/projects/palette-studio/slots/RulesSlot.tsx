"use client";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import RulesRail from "../components/RulesRail";
import MissingFrame from "./MissingFrame";

/** The generative rules — every EngineOptions.rules choice as a labelled radio group. */
export default function RulesSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="rules" />;
  return (
    <Panel label="Rules">
      <RulesRail
        idPrefix={studio.idPrefix}
        rules={studio.rules}
        gamut={studio.gamut}
        onRulesChange={studio.patchRules}
        onGamutChange={studio.setGamut}
      />
    </Panel>
  );
}
