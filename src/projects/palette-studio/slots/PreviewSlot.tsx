"use client";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import PreviewPanel from "../components/PreviewPanel";
import HarmonyStrip from "../components/HarmonyStrip";
import MissingFrame from "./MissingFrame";
import styles from "./slots.module.css";

/** The live preview — both schemes side by side, plus the decorative harmony strip. */
export default function PreviewSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="live preview" />;
  return (
    <Panel label="Live preview">
      <div className={styles.pair}>
        <PreviewPanel scheme="light" tokens={studio.palette.light.tokens} />
        <PreviewPanel scheme="dark" tokens={studio.palette.dark.tokens} />
      </div>
      <HarmonyStrip harmony={studio.harmony} />
    </Panel>
  );
}
