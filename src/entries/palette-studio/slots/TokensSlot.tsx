"use client";

import { useMemo } from "react";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import { buildCards } from "../cards/cardModel";
import SwatchGrid from "../cards/SwatchGrid";
import MissingFrame from "./MissingFrame";

/**
 * The swatch-card grid slot — one derivation card per semantic color (#154). Owns the single
 * reshape of the studio's engine run into card records (keyed on the palette, so a scheme
 * toggle re-picks each card's face without rebuilding), then hands them to the presentational
 * grid. Replaces the old semantic-token table.
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
      <SwatchGrid cards={cards} scheme={studio.scheme} />
    </Panel>
  );
}
