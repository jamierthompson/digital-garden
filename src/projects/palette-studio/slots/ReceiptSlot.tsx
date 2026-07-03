"use client";

import Panel, { PanelNote } from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import ContrastReceipt from "../ContrastReceipt";
import MissingFrame from "./MissingFrame";
import styles from "./slots.module.css";

/** The contrast receipt — measured proof, both schemes, every readable pair. */
export default function ReceiptSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="contrast receipt" />;
  return (
    <Panel label="Contrast receipt">
      <PanelNote>
        Measured on the generated tokens — every readable pair clears its WCAG
        floor and APCA target, in both schemes. That&rsquo;s the guarantee.
      </PanelNote>
      <div className={styles.pair}>
        <ContrastReceipt scheme="light" tokens={studio.palette.light.tokens} />
        <ContrastReceipt scheme="dark" tokens={studio.palette.dark.tokens} />
      </div>
    </Panel>
  );
}
