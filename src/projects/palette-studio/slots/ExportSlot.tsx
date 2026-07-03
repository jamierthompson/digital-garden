"use client";

import Note from "@/components/ui/Note";
import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import ExportPanel from "../ExportPanel";
import MissingFrame from "./MissingFrame";

/** The export surface — the live token set, serialized by the engine itself. */
export default function ExportSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="export" />;
  return (
    <Panel label="Export">
      <Note>
        The same tokens, serialized by the engine — never re-typed here, so the
        export can&rsquo;t drift from what you see above.
      </Note>
      <ExportPanel tokenSet={studio.palette.tokenSet} />
    </Panel>
  );
}
