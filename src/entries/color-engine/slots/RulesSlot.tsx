"use client";

import Panel from "@/components/ui/Panel";

import { useColorEngine } from "../ColorEngineProvider";
import GamutAwareness from "../components/GamutAwareness";
import RulesBoard from "../components/RulesBoard";
import MissingFrame from "./MissingFrame";

/** The generative rules — every EngineOptions.rules choice as a labelled radio group, plus the
 *  screen-gamut awareness (the target gamut is set here, so the "your screen" read sits with it). */
export default function RulesSlot(): React.ReactElement {
  const colorEngine = useColorEngine();
  if (!colorEngine) return <MissingFrame name="rules" />;
  return (
    <Panel label="Rules" style={colorEngine.slotStyle}>
      <RulesBoard
        idPrefix={colorEngine.idPrefix}
        rules={colorEngine.rules}
        gamut={colorEngine.gamut}
        onRulesChange={colorEngine.patchRules}
        onGamutChange={colorEngine.setGamut}
      />
      <GamutAwareness />
    </Panel>
  );
}
