"use client";

import { useMemo } from "react";

import Panel from "@/components/ui/Panel";

import { useColorEngine } from "../ColorEngineProvider";
import { buildCards } from "../cards/cardModel";
import TokenTable from "../cards/TokenTable";
import MissingFrame from "./MissingFrame";

/**
 * The palette table slot — a compact, scanning companion to the swatch-card grid
 * (`TokensSlot`): one row per semantic token instead of one card, so the same token set can be
 * scanned at a glance alongside the cards, not instead of them. Owns its own reshape of the
 * engine run into card records, same as
 * `TokensSlot` — a cheap pure reshape of an already-derived palette, so recomputing it here
 * keeps the two slots independent rather than threading shared state between them.
 */
export default function PaletteTableSlot(): React.ReactElement {
  const colorEngine = useColorEngine();
  // Key on the palette, not the whole Color Engine value — a scheme toggle changes the Color Engine
  // object identity but not the palette, so the cards (which carry both schemes) are reused.
  const palette = colorEngine?.palette;
  const cards = useMemo(() => (palette ? buildCards(palette) : []), [palette]);
  if (!colorEngine) return <MissingFrame name="palette table" />;
  return (
    <Panel label="Palette table" style={colorEngine.slotStyle}>
      <TokenTable cards={cards} scheme={colorEngine.scheme} />
    </Panel>
  );
}
