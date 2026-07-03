// The read-only contrast receipt (#106) for ONE scheme — the measured proof that every
// readable pair clears its target. Display-only: it MEASURES the resolved tokens (contrast.ts)
// and prints WCAG ratio + APCA Lc + a pass mark; it never solves color. The card is itself
// scoped to the generated palette (tokensToScopeVars) so it sits on this scheme's real surface
// with this scheme's real text — the numbers and the surface they describe agree by
// construction.

import type { Scheme, SchemeTokens } from "@garden/oklch";

import { measureReceipt } from "../core/contrast";
import { tokensToScopeVars } from "../core/scope";
import styles from "./ContrastReceipt.module.css";

interface ContrastReceiptProps {
  readonly scheme: Scheme;
  readonly tokens: SchemeTokens;
}

export default function ContrastReceipt({
  scheme,
  tokens,
}: ContrastReceiptProps): React.ReactElement {
  const rows = measureReceipt(tokens);
  return (
    <div
      className={styles.card}
      style={{ ...tokensToScopeVars(tokens), colorScheme: scheme }}
      role="group"
      aria-label={`${scheme} contrast receipt`}
    >
      <span className={styles.label}>{scheme}</span>
      <dl className={styles.rows}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt className={styles.name}>{row.label}</dt>
            <dd className={styles.measure}>
              <span className={styles.value}>
                Lc {row.apca.toFixed(0)} · {row.wcag.toFixed(1)}:1
              </span>
              <span
                className={styles.mark}
                data-pass={row.passes ? "" : undefined}
                role="img"
                aria-label={row.passes ? "passes" : "fails"}
              >
                {row.passes ? "✓" : "✗"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
