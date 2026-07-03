"use client";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import TokenTable from "../components/TokenTable";
import MissingFrame from "./MissingFrame";

/** The semantic-token table — true bindings from the engine's provenance, per scheme. */
export default function TokensSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="semantic tokens" />;
  return (
    <Panel label="Semantic tokens">
      <TokenTable rows={studio.palette.rows} scheme={studio.scheme} />
    </Panel>
  );
}
