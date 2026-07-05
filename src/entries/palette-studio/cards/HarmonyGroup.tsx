"use client";

// The decorative harmony card group (#154 phase 3 / #152) — the batteries-included harmony
// tier rendered as a CLEARLY-SEPARATED, opt-in group: one card per derived hue, each with its
// receipt-backed text + fill picks. Framed as decorative and non-contract (an aside says so),
// so it never reads as part of the guaranteed semantic palette. Mounted in the studio canvas's
// reserved `harmony` grid region; shows the active scheme's picks, like the semantic cards.

import Aside from "@/components/ui/Aside";
import Panel from "@/components/ui/Panel";

import { HARMONY_HUES } from "@garden/oklch";

import { useStudio } from "../StudioProvider";
import MissingFrame from "../slots/MissingFrame";
import HarmonyHueCard from "./HarmonyHueCard";
import styles from "./HarmonyGroup.module.css";

export default function HarmonyGroup(): React.ReactElement {
  const studio = useStudio();
  if (!studio) return <MissingFrame name="harmony" />;
  const { harmonyTier, scheme } = studio;
  return (
    <Panel label="Decorative harmony" style={studio.slotStyle}>
      <Aside>
        Decorative harmony hues — colors in mathematical harmony with your seed,
        for charts, gradients, and secondary accents. NOT part of the token
        contract: each pick is receipt-backed, but run any new pairing through
        the contrast check before you put text on one.
      </Aside>
      <ul className={styles.grid}>
        {HARMONY_HUES.map((hue) => (
          <HarmonyHueCard
            key={hue}
            hue={harmonyTier.hues[hue]}
            scheme={scheme}
          />
        ))}
      </ul>
    </Panel>
  );
}
