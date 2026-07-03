"use client";

import Kicker from "@/components/ui/Kicker";
import Panel from "@/components/ui/Panel";

import { describeAnchor } from "../core/derive";
import { useStudio } from "../StudioProvider";
import SeedRow from "../components/SeedRow";
import MissingFrame from "./MissingFrame";
import styles from "./slots.module.css";

/** The seed input + preset chips, with the engine's anchor readout beneath. */
export default function SeedSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="seed" />;
  return (
    <Panel label="Seed">
      <SeedRow
        idPrefix={studio.idPrefix}
        seed={studio.seed}
        parsed={studio.parsed}
        onSeedChange={studio.setSeed}
      />
      <p className={styles.anchor} role="status" aria-live="polite">
        <Kicker>Anchor</Kicker>
        {describeAnchor(studio.palette)}
      </p>
    </Panel>
  );
}
