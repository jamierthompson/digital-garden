"use client";

import { useMemo } from "react";

import Panel from "@/components/ui/Panel";

import { useColorEngine } from "../ColorEngineProvider";
import { buildCards } from "../cards/cardModel";
import SwatchGrid from "../cards/SwatchGrid";
import MissingFrame from "./MissingFrame";

/**
 * The swatch-card grid slot — one derivation card per semantic color (#154). Owns the single
 * reshape of the Color Engine's engine run into card records (keyed on the palette, so a scheme
 * toggle re-picks each card's face without rebuilding), then hands them to the grid. The shared
 * glossary is a separate region of the Color Engine canvas (`ColorEngineCanvas`), not part of this slot.
 */
export default function TokensSlot(): React.ReactElement {
  const colorEngine = useColorEngine();
  // Key on the palette, not the whole Color Engine value: a scheme toggle changes the Color Engine
  // object identity but not the palette, so the cards (which carry both schemes) are reused.
  const palette = colorEngine?.palette;
  const cards = useMemo(() => (palette ? buildCards(palette) : []), [palette]);
  if (!colorEngine) return <MissingFrame name="swatch cards" />;
  return (
    <Panel label="Swatch cards" variant="plain" style={colorEngine.slotStyle}>
      <SwatchGrid cards={cards} scheme={colorEngine.scheme} />
    </Panel>
  );
}
