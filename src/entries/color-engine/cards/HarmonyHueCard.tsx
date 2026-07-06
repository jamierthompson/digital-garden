// One derived harmony hue (#154 phase 3 / #152) — a DECORATIVE card: the hue's UI-grade fill
// and text-grade picks (receipt-backed by the engine's harmony tier), its relationship to the
// seed, and the ramp step each pick landed on. Non-contract-bearing by design — these are for
// charts, gradients, and secondary accents, not the semantic token set; the group framing
// says so. Display-only; every value is a baked engine literal.

import Swatch from "@/components/ui/Swatch";

import {
  formatOklch,
  type HarmonyHueTier,
  type HarmonyKind,
  type Scheme,
} from "@garden/oklch";

import styles from "./HarmonyHueCard.module.css";

interface HarmonyHueCardProps {
  readonly hue: HarmonyHueTier;
  /** The active scheme — the group shows one scheme's picks, like the semantic cards. */
  readonly scheme: Scheme;
}

/** Plain-language gloss for each color-theory relationship — the copy rule applies here too. */
const RELATIONSHIP_GLOSS: Record<HarmonyKind, string> = {
  analogous: "a neighbor on the color wheel",
  complementary: "the opposite on the color wheel",
  triadic: "one of three evenly-spaced hues",
  "split-complementary": "just beside the opposite",
};

/** The signed offset as a degree label — "+180°", "−30°". */
function formatOffset(offset: number): string {
  // Real minus sign for the negatives; a leading plus for the positives.
  if (offset < 0) return `−${Math.abs(offset)}°`;
  return `+${offset}°`;
}

export default function HarmonyHueCard({
  hue,
  scheme,
}: HarmonyHueCardProps): React.ReactElement {
  const fill = scheme === "light" ? hue.fill.light : hue.fill.dark;
  const text = scheme === "light" ? hue.text.light : hue.text.dark;
  // Swatch/chip fills paint per the browser's resolved scheme (light-dark()), flash-free; the
  // oklch/step text is still `facet`-resolved (the text CSS-toggle rides a follow-up).
  const fillLD = `light-dark(${formatOklch(hue.fill.light.color)}, ${formatOklch(hue.fill.dark.color)})`;
  const textLD = `light-dark(${formatOklch(hue.text.light.color)}, ${formatOklch(hue.text.dark.color)})`;
  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <span className={styles.relationship}>{hue.relationship}</span>
        <span className={styles.offset}>{formatOffset(hue.offset)}</span>
      </div>
      <p className={styles.gloss}>{RELATIONSHIP_GLOSS[hue.relationship]}</p>

      <div className={styles.fill}>
        <Swatch color={fillLD} />
      </div>

      <dl className={styles.picks}>
        <div>
          <dt>fill</dt>
          <dd>
            <span
              className={styles.chip}
              style={{ background: fillLD }}
              aria-hidden="true"
            />
            {formatOklch(fill.color)} · step {fill.provenance.label}
          </dd>
        </div>
        <div>
          <dt>text</dt>
          <dd>
            <span
              className={styles.chip}
              style={{ background: textLD }}
              aria-hidden="true"
            />
            {formatOklch(text.color)} · step {text.provenance.label}
          </dd>
        </div>
      </dl>
    </li>
  );
}
