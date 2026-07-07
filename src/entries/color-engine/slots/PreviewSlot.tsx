"use client";

import Panel from "@/components/ui/Panel";

import { useColorEngine } from "../ColorEngineProvider";
import PreviewCard from "../components/PreviewCard";
import MissingFrame from "./MissingFrame";

/**
 * The live preview — the generated palette on real component shapes (a card, controls, status
 * badges), for the ACTIVE scheme, matching the single-scheme cards (the site-wide toggle flips
 * it, which IS the light-dark() demo).
 */
export default function PreviewSlot(): React.ReactElement {
  const colorEngine = useColorEngine();
  if (!colorEngine) return <MissingFrame name="live preview" />;
  return (
    <Panel label="Live preview" variant="plain" style={colorEngine.slotStyle}>
      {/* No scheme prop — the specimens inherit the slot's `light-dark()` tokens and paint the
          viewer's scheme at first paint (flash-free). */}
      <PreviewCard />
    </Panel>
  );
}
