// The decorative brand-harmony strip (#102) — hue sets in mathematical harmony with the seed
// (analogous, complementary, triadic, split-complementary) for charts / gradients / secondary
// accents. DECORATIVE, not semantic: these are non-contrast-bearing, kept out of the token
// contract; the strip just displays them. Scheme-independent (built from the raw seed), so it
// renders once, not per scheme.

import Note from "@/components/ui/Note";

import { formatOklch, HARMONY_KINDS, type HarmonyPalette } from "@garden/oklch";

import styles from "./HarmonyStrip.module.css";

interface HarmonyStripProps {
  readonly harmony: HarmonyPalette;
}

export default function HarmonyStrip({
  harmony,
}: HarmonyStripProps): React.ReactElement {
  return (
    <div className={styles.strip}>
      <Note>
        Decorative harmony sets — for charts, gradients, and secondary accents.
        Not part of the contract; run them through the receipt before putting
        text on one.
      </Note>
      <div className={styles.groups}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>seed</span>
          <span
            className={styles.swatch}
            style={{ background: formatOklch(harmony.seed) }}
            title={formatOklch(harmony.seed)}
          />
        </div>
        {HARMONY_KINDS.map((kind) => (
          <div key={kind} className={styles.group}>
            <span className={styles.groupLabel}>{kind}</span>
            <div className={styles.swatches}>
              {harmony[kind].map((color, i) => {
                const value = formatOklch(color);
                return (
                  <span
                    key={`${kind}-${i}`}
                    className={styles.swatch}
                    style={{ background: value }}
                    title={value}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
