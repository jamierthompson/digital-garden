"use client";

import Panel from "@/components/ui/Panel";
import SegmentedControl from "@/components/ui/SegmentedControl";

import type { Scheme } from "@garden/oklch";

import { useStudio } from "../StudioProvider";
import PrimitivesBoard from "../PrimitivesBoard";
import MissingFrame from "./MissingFrame";
import styles from "./slots.module.css";

const SCHEME_OPTIONS = [
  { value: "light", label: "light" },
  { value: "dark", label: "dark" },
] as const satisfies readonly { value: Scheme; label: string }[];

/**
 * The primitive ramps board. Carries the displayed-scheme toggle — shared state, so the
 * token table follows it (placement is a slice-3 design call with the owner).
 */
export default function PrimitivesSlot(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="primitive ramps" />;
  return (
    <Panel label="Primitive ramps">
      <div className={styles.head}>
        <SegmentedControl
          label="Displayed scheme"
          value={studio.scheme}
          onValueChange={studio.setScheme}
          options={SCHEME_OPTIONS}
        />
      </div>
      <PrimitivesBoard ramps={studio.view.ramps} />
    </Panel>
  );
}
