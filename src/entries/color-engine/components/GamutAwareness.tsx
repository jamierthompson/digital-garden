"use client";

// Screen-gamut awareness (#155) — answers the one thing the receipts couldn't: is the viewer's
// OWN screen painting these colors as specified? Two parts:
//   • a "your screen" chip (sRGB vs Display-P3), detected with the CSS Media Queries 4
//     `color-gamut` feature — PURE CSS, both states in the HTML, one shown per `@media`, so
//     there is no JS, no hydration mismatch, and no flash;
//   • a target-vs-screen line: when the palette targets sRGB (the safe default) a reassurance;
//     when it targets P3 on an sRGB screen, a warning that the vivid colors are trimmed (each
//     trimmed swatch is flagged on its card, see `ContrastChip`/`ClampReceipt`).
//
// Honest limit baked into the copy: `color-gamut` is the browser/OS claim about the output
// device ("approximately that gamut or wider") — it says nothing about calibration or ICC
// profiles. So the copy stays at "can your screen show P3", never "is your screen accurate".

import { useColorEngine } from "../ColorEngineProvider";
import styles from "./GamutAwareness.module.css";

export default function GamutAwareness(): React.ReactElement | null {
  const colorEngine = useColorEngine();
  if (!colorEngine) return null;
  const targetsP3 = colorEngine.gamut === "p3";
  return (
    <div className={styles.awareness} role="note" aria-label="Your screen">
      <p className={styles.chip}>
        <span className={styles.screenLabel}>Your screen:</span>{" "}
        <span className={styles.srgbOnly}>sRGB</span>
        <span className={styles.p3Only}>Display-P3 capable</span>
      </p>
      {targetsP3 ? (
        <p className={styles.message}>
          <span className={styles.srgbOnly}>
            Your screen is sRGB, so the more-vivid P3 colors are trimmed to fit
            — each trimmed swatch is flagged.
          </span>
          <span className={styles.p3Only}>
            Your screen shows Display-P3, so these colors paint as specified.
          </span>
        </p>
      ) : (
        <p className={styles.message}>
          Mapped to sRGB — these colors paint identically on every screen,
          including this one.
          <span className={styles.p3Only}>
            {" "}
            (Your screen could show more; this palette trades that for identical
            paint everywhere.)
          </span>
        </p>
      )}
    </div>
  );
}
