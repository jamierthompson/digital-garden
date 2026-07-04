// One swatch card (#154) — the complete record of a single semantic color, in plain language:
// the swatch, its `oklch()` value + hex fallback, how the engine made it, where it sits on its
// scale, the measured contrast, where you'd use it, and a one-line hint of what it becomes in
// the other color scheme. An agent-reasoning-chain UI, but for one color.
//
// The card shows ONE scheme — the active (viewer's) one; the site-wide light/dark toggle (#133)
// is how users compare schemes (flipping it re-solves the page live, which IS the light-dark()
// demo). Nothing here hardcodes a scheme: the facet is picked from `scheme`, so the toggle
// flips it for free. The disclosure holds plain-language definitions of the terms of art.

import Swatch from "@/components/ui/Swatch";

import type { BindingKind } from "./cardContract";
import type { SwatchCardData } from "./cardModel";
import { oogNote } from "./derivationCopy";
import CardDisclosure from "./CardDisclosure";
import ContrastChip from "./ContrastChip";
import MiniRamp from "./MiniRamp";
import styles from "./SwatchCard.module.css";

interface SwatchCardProps {
  readonly card: SwatchCardData;
  /** The scheme the card face shows — the studio's active (viewer's) scheme. */
  readonly scheme: "light" | "dark";
}

/** A plain-language badge for the binding kind — the role at a glance, no jargon. */
const KIND_BADGE: Record<BindingKind, string> = {
  step: "background",
  auto: "auto-picked",
  accent: "brand color",
  "on-accent": "label",
};

export default function SwatchCard({
  card,
  scheme,
}: SwatchCardProps): React.ReactElement {
  const facet = scheme === "light" ? card.light : card.dark;
  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.name}>--{card.name}</h3>
        <span className={styles.badge}>{KIND_BADGE[card.kind]}</span>
      </div>

      <div className={styles.swatch}>
        <Swatch color={facet.oklch} oog={facet.oog} />
      </div>

      <dl className={styles.values}>
        <div>
          <dt className={styles.srOnly}>OKLCH value</dt>
          <dd className={styles.valueOklch}>{facet.oklch}</dd>
        </div>
        <div>
          <dt className={styles.srOnly}>Hex fallback</dt>
          <dd className={styles.valueHex}>{facet.hex}</dd>
        </div>
      </dl>

      <p className={styles.sentence}>{facet.sentence}</p>

      {facet.ramp && facet.boundStep ? (
        <MiniRamp
          ramp={facet.ramp}
          boundStep={facet.boundStep}
          tokenName={card.name}
        />
      ) : null}

      <ContrastChip measured={facet.measured} />

      <p className={styles.usage}>{card.usage}</p>

      <CardDisclosure
        label="More about this color"
        title={`--${card.name} — the details`}
      >
        <div className={styles.disclosure}>
          <p className={styles.counterpart}>{facet.counterpart}</p>
          {facet.oog ? <p className={styles.oogNote}>{oogNote()}</p> : null}
        </div>
      </CardDisclosure>
    </li>
  );
}
