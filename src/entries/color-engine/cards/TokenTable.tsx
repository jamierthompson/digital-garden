// The palette table — a compact, scanning companion to the swatch-card grid (`SwatchGrid`).
// Restored by owner request (it existed pre-#154 as a plain semantic-token table, deleted when
// the card system replaced it) and rebuilt over the CURRENT card data model rather than
// un-deleted verbatim, so it reads the same per-token record the cards do: token name, the ramp
// step (or "solved" for a co-solve) it bound to, the resolved value with its swatch, and — new,
// since the cards now compute it — the live contrast readout. One row per token, so it scales to
// however many the contract carries (14 today) without a layout change.
//
// Presentational: it takes the pre-built card records (`buildCards`, cardModel.ts) and lays them
// out; the slot owns the one engine run. The swatch paints via `light-dark()` off BOTH facets —
// same trick as `SwatchCard` — so it lands on the right color at first paint instead of
// light-first-then-correct; only the step/value/contrast text cells pick the active scheme.

import type { Scheme } from "@garden/oklch";

import Swatch from "@/components/ui/Swatch";

import type { SwatchCardData } from "./cardModel";
import styles from "./TokenTable.module.css";

interface TokenTableProps {
  readonly cards: readonly SwatchCardData[];
  /** The scheme each row's text cells show — the Color Engine's active (viewer's) scheme. */
  readonly scheme: Scheme;
}

export default function TokenTable({
  cards,
  scheme,
}: TokenTableProps): React.ReactElement {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Ramp step</th>
            <th scope="col">Value</th>
            <th scope="col">Contrast</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const facet = scheme === "light" ? card.light : card.dark;
            const fill = `light-dark(${card.light.oklch}, ${card.dark.oklch})`;
            return (
              <tr key={card.name}>
                <th scope="row" className={styles.name}>
                  --{card.name}
                </th>
                <td className={styles.step}>
                  {facet.boundStep ? (
                    <>
                      {facet.boundStep.role} · {facet.boundStep.label}
                    </>
                  ) : (
                    <span className={styles.solved}>solved</span>
                  )}
                </td>
                <td className={styles.value}>
                  <span className={styles.swatchBox}>
                    <Swatch color={fill} oog={facet.oog} />
                  </span>
                  <span className={styles.valueText}>{facet.oklch}</span>
                </td>
                <td className={styles.contrast}>
                  {facet.measured ? (
                    <span className={styles.contrastValue}>
                      {facet.measured.wcag.toFixed(1)}:1 · Lc{" "}
                      {facet.measured.apca.toFixed(0)}
                      <span
                        className={styles.mark}
                        data-pass={facet.measured.passes ? "" : undefined}
                        role="img"
                        aria-label={facet.measured.passes ? "passes" : "fails"}
                      >
                        {facet.measured.passes ? "✓" : "✗"}
                      </span>
                    </span>
                  ) : (
                    <span className={styles.solved}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
