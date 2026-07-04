// One scheme's full detail block (#154) — rendered twice inside a card's disclosure (light +
// dark), so the "Full receipt" shows BOTH schemes even though the card face shows only the
// active one. Its own component so `SwatchCard` stays the face's concern, not both. Display-
// only; every value is pre-computed in `cardModel`.

import Swatch from "@/components/ui/Swatch";

import { formatStep } from "./derivationCopy";
import type { SchemeFacet } from "./cardModel";
import ContrastChip from "./ContrastChip";
import MiniRamp from "./MiniRamp";
import styles from "./FacetDetail.module.css";

interface FacetDetailProps {
  readonly facet: SchemeFacet;
  /** The token name — the mini-ramp's accessible context. */
  readonly name: string;
}

export default function FacetDetail({
  facet,
  name,
}: FacetDetailProps): React.ReactElement {
  return (
    <div className={styles.facet}>
      <div className={styles.head}>
        <span className={styles.swatch}>
          <Swatch color={facet.oklch} oog={facet.oog} />
        </span>
        <span className={styles.scheme}>{facet.scheme}</span>
      </div>
      <p className={styles.sentence}>{facet.sentence}</p>
      {facet.ramp && facet.boundStep ? (
        <MiniRamp
          ramp={facet.ramp}
          boundStep={facet.boundStep}
          tokenName={name}
        />
      ) : null}
      <dl className={styles.values}>
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
