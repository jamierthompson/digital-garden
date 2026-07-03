// The primitives board — the pure lightness primitive tier the semantic tokens bind to: one
// generative ramp per role (brand, neutral, and the four status hues), each 11 steps
// (50…950), for the currently displayed scheme. Steps flagged out-of-gamut (the engine had
// to trim chroma to fit the target gamut) carry a subtle marker. Display-only; every color is
// a baked engine literal painted inline.

import {
  formatOklch,
  RAMP_ROLES,
  type Ramp,
  type RampRole,
} from "@garden/oklch";

import styles from "./PrimitivesBoard.module.css";

interface PrimitivesBoardProps {
  readonly ramps: Record<RampRole, Ramp>;
}

/** The 11 step labels are identical across roles — read them off the first ramp. */
export default function PrimitivesBoard({
  ramps,
}: PrimitivesBoardProps): React.ReactElement {
  const labels = ramps.brand.map((s) => s.label);
  return (
    <div
      className={styles.board}
      style={{ ["--step-count" as string]: labels.length }}
      role="group"
      aria-label="Generated primitive ramps"
    >
      <div className={styles.headRow} aria-hidden="true">
        <span className={styles.roleHead} />
        {labels.map((label) => (
          <span key={label} className={styles.stepLabel}>
            {label}
          </span>
        ))}
      </div>

      {RAMP_ROLES.map((role) => (
        <div key={role} className={styles.rampRow}>
          <span className={styles.roleLabel}>{role}</span>
          {ramps[role].map((step) => {
            const value = formatOklch(step.color);
            return (
              <span
                key={step.label}
                className={styles.step}
                style={{ background: value }}
                data-oog={step.oog ? "" : undefined}
                title={`${role} ${step.label}: ${value}${step.oog ? " · out of gamut" : ""}`}
                aria-label={`${role} ${step.label}${step.oog ? ", out of gamut" : ""}: ${value}`}
              >
                {step.oog ? (
                  <span className={styles.oogDot} aria-hidden="true" />
                ) : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
