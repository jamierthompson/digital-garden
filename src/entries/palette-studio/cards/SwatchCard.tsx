// One swatch card (#154) — the complete record of a single semantic color: the swatch, its
// `oklch()` value + hex fallback, the derivation sentence (how the engine derived it), where
// it sits on its ramp, live-measured contrast, and where you'd use it. An agent-reasoning-
// chain UI, but for one color. Everything beyond what the face holds — the other scheme, the
// full ramp, the gamut story — lives behind the progressive-disclosure preview.
//
// Display-only: every value comes pre-computed from `cardModel` (one engine run reshaped).
// The face shows the ACTIVE scheme; the disclosure renders a `FacetDetail` per scheme, so the
// 14 cards stay scannable while the full both-scheme receipt is one interaction away.

import Swatch from "@/components/ui/Swatch";

import type { BindingKind } from "./cardContract";
import type { SwatchCardData } from "./cardModel";
import CardDisclosure from "./CardDisclosure";
import ContrastChip from "./ContrastChip";
import FacetDetail from "./FacetDetail";
import MiniRamp from "./MiniRamp";
import styles from "./SwatchCard.module.css";

interface SwatchCardProps {
  readonly card: SwatchCardData;
  /** The scheme the card face shows — the studio's active (viewer's) scheme. */
  readonly scheme: "light" | "dark";
}

/** A one-word badge for the binding kind — the derivation story at a glance. */
const KIND_BADGE: Record<BindingKind, string> = {
  step: "surface",
  auto: "solved",
  accent: "co-solved",
  "on-accent": "co-solved",
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
        label="Full receipt"
        title={`--${card.name} — both schemes`}
      >
        <div className={styles.disclosure}>
          <FacetDetail facet={card.light} name={card.name} />
          <FacetDetail facet={card.dark} name={card.name} />
          {card.oogNote ? (
            <p className={styles.oogNote}>{card.oogNote}</p>
          ) : null}
        </div>
      </CardDisclosure>
    </li>
  );
}
