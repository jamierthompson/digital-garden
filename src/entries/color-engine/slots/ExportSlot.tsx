"use client";

import Aside from "@/components/ui/Aside";
import Panel from "@/components/ui/Panel";

import { useColorEngine } from "../ColorEngineProvider";
import ExportTabs from "../components/ExportTabs";
import MissingFrame from "./MissingFrame";

/** The export surface — the live token set, serialized by the engine itself. */
export default function ExportSlot(): React.ReactElement {
  const colorEngine = useColorEngine();
  if (!colorEngine) return <MissingFrame name="export" />;
  return (
    <Panel label="Export" style={colorEngine.slotStyle}>
      <Aside>
        The same tokens, serialized by the engine — never re-typed here, so the
        export can&rsquo;t drift from what you see above.
      </Aside>
      <ExportTabs tokenSet={colorEngine.palette.tokenSet} />
    </Panel>
  );
}
