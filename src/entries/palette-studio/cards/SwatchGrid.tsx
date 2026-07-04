// The swatch-card grid (#154) — one derivation card per semantic color, the studio's
// centerpiece. Replaces the old token table / primitives board / standalone receipt: each
// card now carries its own ramp position and live contrast, so the palette reads as 14
// self-contained receipts rather than islands of information. Presentational: it takes the
// pre-built card records and lays them out; `TokensSlot` owns the one engine run.

import type { Scheme } from "@garden/oklch";

import type { SwatchCardData } from "./cardModel";
import SwatchCard from "./SwatchCard";
import styles from "./SwatchGrid.module.css";

interface SwatchGridProps {
  readonly cards: readonly SwatchCardData[];
  /** The scheme each card face shows — the studio's active (viewer's) scheme. */
  readonly scheme: Scheme;
}

export default function SwatchGrid({
  cards,
  scheme,
}: SwatchGridProps): React.ReactElement {
  return (
    // Explicit role: `list-style: none` drops list semantics in some engines (Safari/VoiceOver).
    <ul className={styles.grid} role="list">
      {cards.map((card) => (
        <SwatchCard key={card.name} card={card} scheme={scheme} />
      ))}
    </ul>
  );
}
