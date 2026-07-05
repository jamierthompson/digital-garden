"use client";

import { useMemo } from "react";

import Panel from "@/components/ui/Panel";

import { useStudio } from "../StudioProvider";
import { buildCards } from "../cards/cardModel";
import TokenTable from "../cards/TokenTable";
import MissingFrame from "./MissingFrame";

/**
 * The palette table slot — a compact, scanning companion to the swatch-card grid
 * (`TokensSlot`): one row per semantic token instead of one card, so the same token set (14
 * today, more once the contract grows) can be scanned at a glance alongside the cards, not
 * instead of them. Owns its own reshape of the engine run into card records, same as
 * `TokensSlot` — a cheap pure reshape of an already-derived palette, so recomputing it here
 * keeps the two slots independent rather than threading shared state between them.
 */
export default function PaletteTableSlot(): React.ReactElement {
  const studio = useStudio();
  // Key on the palette, not the whole studio value — a scheme toggle changes the studio
  // object identity but not the palette, so the cards (which carry both schemes) are reused.
  const palette = studio?.palette;
  const cards = useMemo(() => (palette ? buildCards(palette) : []), [palette]);
  if (!studio) return <MissingFrame name="palette table" />;
  return (
    <Panel label="Palette table" style={studio.slotStyle}>
      <TokenTable cards={cards} scheme={studio.scheme} />
    </Panel>
  );
}
