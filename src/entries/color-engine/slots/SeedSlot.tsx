"use client";

import Kicker from "@/components/ui/Kicker";
import Panel from "@/components/ui/Panel";

import { describeAnchor } from "../core/derive";
import { useColorEngine } from "../ColorEngineProvider";
import SeedRow from "../components/SeedRow";
import MissingFrame from "./MissingFrame";
import styles from "./slots.module.css";

/** The seed input + preset chips, with the engine's anchor readout beneath. */
export default function SeedSlot(): React.ReactElement {
  const colorEngine = useColorEngine();
  if (!colorEngine) return <MissingFrame name="seed" />;
  return (
    <Panel label="Seed" style={colorEngine.slotStyle}>
      <SeedRow
        idPrefix={colorEngine.idPrefix}
        seed={colorEngine.seed}
        parsed={colorEngine.parsed}
        onSeedChange={colorEngine.setSeed}
      />
      <p className={styles.anchor} role="status" aria-live="polite">
        <Kicker>Anchor</Kicker>
        {describeAnchor(colorEngine.palette)}
      </p>
    </Panel>
  );
}
