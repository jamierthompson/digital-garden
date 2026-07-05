// Per-swatch sRGB clamp receipt (#155) — the companion to `ContrastChip`. When a P3-target
// palette bakes a color more saturated than sRGB can show, THIS viewer's sRGB screen trims it;
// the receipt says so and by how much. Rendered only when the color actually exceeds sRGB (the
// model's `clamp`), and shown only on an sRGB screen — a Display-P3 screen paints the full
// color, so the receipt hides itself via the `color-gamut` media toggle (pure CSS, no JS).
//
// Text-backed (not color-only): the sentence carries the meaning; the color is just emphasis.

import styles from "./ClampReceipt.module.css";

interface ClampReceiptProps {
  /** The sRGB clamp, or `null` when the color already fits sRGB (no receipt). */
  readonly clamp: { readonly deltaC: number } | null;
}

export default function ClampReceipt({
  clamp,
}: ClampReceiptProps): React.ReactElement | null {
  if (!clamp) return null;
  return (
    <p className={styles.clamp} role="note">
      More vivid than an sRGB screen can show — trimmed by{" "}
      {clamp.deltaC.toFixed(2)} to fit.
    </p>
  );
}
