"use client";

import { useMemo } from "react";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import { buildCards } from "../cards/cardModel";
import GlossarySidebar from "../cards/GlossarySidebar";
import SwatchGrid from "../cards/SwatchGrid";
import styles from "./slots.module.css";
import MissingFrame from "./MissingFrame";

/**
 * The swatch-card grid slot — one derivation card per semantic color (#154). Owns the single
 * reshape of the studio's engine run into card records (keyed on the palette, so a scheme
 * toggle re-picks each card's face without rebuilding), then lays them out beside the shared
 * plain-language glossary (defined once, not repeated per card). Replaces the old token table.
 */
export default function TokensSlot(): React.ReactElement {
  const studio = useStudio();
  // Key on the palette, not the whole studio value: a scheme toggle changes the studio
  // object identity but not the palette, so the cards (which carry both schemes) are reused.
  const palette = studio?.palette;
  const cards = useMemo(() => (palette ? buildCards(palette) : []), [palette]);
  if (!studio) return <MissingFrame name="swatch cards" />;
  return (
    <Panel label="Swatch cards" style={studio.slotStyle}>
      <div className={styles.cardsLayout}>
        <SwatchGrid cards={cards} scheme={studio.scheme} />
        <GlossarySidebar />
      </div>
    </Panel>
  );
}
