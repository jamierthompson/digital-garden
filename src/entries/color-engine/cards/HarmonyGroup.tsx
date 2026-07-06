"use client";

// The decorative harmony card group (#154 phase 3 / #152) — the batteries-included harmony
// tier rendered as a CLEARLY-SEPARATED, opt-in group: one card per derived hue, each with its
// receipt-backed text + fill picks. Framed as decorative and non-contract (an aside says so),
// so it never reads as part of the guaranteed semantic palette. Mounted in the Color Engine canvas's
// reserved `harmony` grid region; shows the active scheme's picks, like the semantic cards.

import Panel from "@/components/ui/Panel";

import { HARMONY_HUES } from "@garden/oklch";

import { useColorEngine } from "../ColorEngineProvider";
import MissingFrame from "../slots/MissingFrame";
import HarmonyHueCard from "./HarmonyHueCard";
import styles from "./HarmonyGroup.module.css";

export default function HarmonyGroup(): React.ReactElement {
  const colorEngine = useColorEngine();
  if (!colorEngine) return <MissingFrame name="harmony" />;
  const { harmonyTier, scheme } = colorEngine;
  return (
    <Panel label="Harmony hues" variant="plain" style={colorEngine.slotStyle}>
      {/* No blurb — the owner is authoring the harmony copy separately; the heading (the Panel's
          "Harmony hues" region label) carries the naming until then. */}
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
