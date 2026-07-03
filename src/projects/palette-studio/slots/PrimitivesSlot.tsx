"use client";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import PrimitivesBoard from "../components/PrimitivesBoard";
import MissingFrame from "./MissingFrame";

/**
 * The primitive ramps board. Displays the viewer's current color scheme — there is no
 * page-local scheme toggle by design (that's site-wide chrome, #133).
 */
export default function PrimitivesSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="primitive ramps" />;
  return (
    <Panel label="Primitive ramps">
      <PrimitivesBoard ramps={studio.view.ramps} />
    </Panel>
  );
}
