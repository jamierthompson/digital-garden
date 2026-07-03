// The semantic token table — the contract components actually read. Names front and center
// (`--text`, `--accent`, …), then the ramp step each token bound to (`neutral · 800`) or
// "solved" for the continuously co-solved accent fill / on-accent label, then the resolved
// value for the displayed scheme. Display-only; the swatch is the baked engine literal.

import { formatOklch, type Scheme } from "@garden/oklch";

import type { TokenRow } from "../core/derive";
import styles from "./TokenTable.module.css";

interface TokenTableProps {
  readonly rows: readonly TokenRow[];
  readonly scheme: Scheme;
}

export default function TokenTable({
  rows,
  scheme,
}: TokenTableProps): React.ReactElement {
  return (
    <table className={styles.table}>
      <caption className={styles.caption}>Showing the {scheme} scheme</caption>
      <thead>
        <tr>
          <th scope="col">Token</th>
          <th scope="col">Ramp step</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cell = row[scheme];
          const value = formatOklch(cell.value);
          return (
            <tr key={row.name}>
              <th scope="row" className={styles.name}>
                --{row.name}
              </th>
              <td className={styles.step}>
                {cell.boundTo ? (
                  <>
                    {cell.boundTo.role} · {cell.boundTo.label}
                  </>
                ) : (
                  <span className={styles.solved}>solved</span>
                )}
              </td>
              <td className={styles.value}>
                <span
                  className={styles.swatch}
                  style={{ background: value }}
                  aria-hidden="true"
                />
                {value}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
