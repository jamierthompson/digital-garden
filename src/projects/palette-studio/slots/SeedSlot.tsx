"use client";

import Panel from "@/components/ui/Panel";

import { describeAnchor } from "../derive";
import { useStudio } from "../StudioProvider";
import SeedRow from "../SeedRow";
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
        <span className={styles.anchorKicker}>Anchor</span>
        {describeAnchor(studio.palette)}
      </p>
    </Panel>
  );
}
