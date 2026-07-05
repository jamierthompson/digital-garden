"use client";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import GamutAwareness from "../components/GamutAwareness";
import RulesBoard from "../components/RulesBoard";
import MissingFrame from "./MissingFrame";

/** The generative rules — every EngineOptions.rules choice as a labelled radio group, plus the
 *  screen-gamut awareness (the target gamut is set here, so the "your screen" read sits with it). */
export default function RulesSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="rules" />;
  return (
    <Panel label="Rules" style={studio.slotStyle}>
      <RulesBoard
        idPrefix={studio.idPrefix}
        rules={studio.rules}
        gamut={studio.gamut}
        onRulesChange={studio.patchRules}
        onGamutChange={studio.setGamut}
      />
      <GamutAwareness />
    </Panel>
  );
}
