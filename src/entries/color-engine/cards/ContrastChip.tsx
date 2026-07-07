// The measured-contrast chip (#154) — a token's live WCAG ratio + APCA Lc with a pass mark,
// e.g. "3.0:1 · Lc 84 ✓". Its own component because both the card face and the disclosure's
// per-scheme detail render it.
// Display-only; the numbers come pre-measured from `cardModel` (a live `checkContrast`).

import type { ContrastCheck } from "@garden/oklch";

import styles from "./ContrastChip.module.css";

interface ContrastChipProps {
  /** The measured pair, or `null` for a surface (a canvas has no foreground receipt). */
  readonly measured: ContrastCheck | null;
}

export default function ContrastChip({
  measured,
}: ContrastChipProps): React.ReactElement | null {
  if (!measured) return null;
  return (
    <p className={styles.chip}>
      <span className={styles.label}>Measured contrast</span>
      <span>
        {measured.wcag.toFixed(1)}:1 · Lc {measured.apca.toFixed(0)}
      </span>
      <span
        className={styles.mark}
        data-pass={measured.passes ? "" : undefined}
        role="img"
        aria-label={measured.passes ? "passes" : "fails"}
      >
        {measured.passes ? "✓" : "✗"}
      </span>
    </p>
  );
}
