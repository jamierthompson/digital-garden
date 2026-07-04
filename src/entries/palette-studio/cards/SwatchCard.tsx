// One swatch card (#154) — the complete record of a single semantic color: the swatch, its
// `oklch()` value + hex fallback, the derivation sentence (how the engine derived it), where
// it sits on its ramp, live-measured contrast, and where you'd use it. An agent-reasoning-
// chain UI, but for one color. Everything beyond what the face holds — the other scheme, the
// full ramp, the gamut story — lives behind the progressive-disclosure preview.
//
// Display-only: every value comes pre-computed from `cardModel` (one engine run reshaped);
// this component only lays it out. The card face shows the ACTIVE scheme; the disclosure
// shows both, so the 14 cards stay scannable while the full receipt is one interaction away.

import Swatch from "@/components/ui/Swatch";

import type { BindingKind } from "./cardContract";
import { formatStep } from "./derivationCopy";
import type { SchemeFacet, SwatchCardData } from "./cardModel";
import CardDisclosure from "./CardDisclosure";
import MiniRamp from "./MiniRamp";
import styles from "./SwatchCard.module.css";

interface SwatchCardProps {
  readonly card: SwatchCardData;
  /** The scheme the card face shows — the studio's active (viewer's) scheme. */
  readonly scheme: "light" | "dark";
}

/** A one-word badge for the binding kind (guide §4) — the derivation story at a glance. */
const KIND_BADGE: Record<BindingKind, string> = {
  step: "surface",
  auto: "solved",
  accent: "co-solved",
  "on-accent": "co-solved",
};

/** A measured contrast pair as a chip — "3.0:1 · Lc 84" with a pass mark. */
function ContrastChip({
  measured,
}: {
  readonly measured: SchemeFacet["measured"];
}): React.ReactElement | null {
  if (!measured) return null;
  return (
    <p className={styles.contrast}>
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

/** One scheme's full detail block — rendered twice inside the disclosure (light + dark). */
function FacetDetail({
  facet,
  name,
}: {
  readonly facet: SchemeFacet;
  readonly name: string;
}): React.ReactElement {
  return (
    <div className={styles.facet}>
      <div className={styles.facetHead}>
        <span className={styles.facetSwatch}>
          <Swatch color={facet.oklch} oog={facet.oog} />
        </span>
        <span className={styles.facetScheme}>{facet.scheme}</span>
      </div>
      <p className={styles.facetSentence}>{facet.sentence}</p>
      {facet.ramp && facet.boundStep ? (
        <MiniRamp
          ramp={facet.ramp}
          boundStep={facet.boundStep}
          tokenName={name}
        />
      ) : null}
      <dl className={styles.facetValues}>
        <div>
          <dt>oklch</dt>
          <dd>{facet.oklch}</dd>
        </div>
        <div>
          <dt>hex</dt>
          <dd>{facet.hex}</dd>
        </div>
        {facet.boundStep ? (
          <div>
            <dt>step</dt>
            <dd>{formatStep(facet.boundStep)}</dd>
          </div>
        ) : null}
      </dl>
      <ContrastChip measured={facet.measured} />
    </div>
  );
}

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
