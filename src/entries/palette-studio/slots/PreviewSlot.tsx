"use client";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import PreviewCard from "../components/PreviewCard";
import MissingFrame from "./MissingFrame";

/**
 * The live preview — the generated palette on real component shapes (a card, controls, status
 * badges), for the ACTIVE scheme, matching the single-scheme cards (the site-wide toggle flips
 * it, which IS the light-dark() demo). The decorative harmony is its own canvas region now
 * (`HarmonyGroup`), so it's no longer bundled here.
 */
export default function PreviewSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="live preview" />;
  return (
    <Panel label="Live preview" style={studio.slotStyle}>
      <PreviewCard scheme={studio.scheme} tokens={studio.view.tokens} />
    </Panel>
  );
}
