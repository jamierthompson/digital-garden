// The mini ramp strip (#154 — the engine guide's ramp-coordinate thread) — the 11 steps of a token's role ramp with the bound
// step marked. The visual thread that teaches the two-tier model with zero prose: "this
// token IS that step". Display-only; every step is a baked engine literal painted inline,
// and the highlighted step comes from the engine's solve-time provenance, never a value scan.

import { formatOklch, type BindingStep, type Ramp } from "@garden/oklch";

import styles from "./MiniRamp.module.css";

interface MiniRampProps {
  readonly ramp: Ramp;
  /** The step this token bound to — highlighted and marked `aria-current`. */
  readonly boundStep: BindingStep;
  /** Extra context for the group's accessible name — e.g. "text". */
  readonly tokenName: string;
}

/**
 * A compact strip of a role's 11 ramp steps, the bound step raised and labelled. The bound
 * step is the only one that carries a visible label + `aria-current="true"`, so the "this
 * token sits HERE" thread reads to both sighted and assistive users.
 */
export default function MiniRamp({
  ramp,
  boundStep,
  tokenName,
}: MiniRampProps): React.ReactElement {
  return (
    <div
      className={styles.ramp}
      style={{ ["--step-count" as string]: ramp.length }}
      role="group"
      aria-label={`${boundStep.role} ramp — --${tokenName} binds to step ${boundStep.label}`}
    >
      {ramp.map((step) => {
        const bound = step.label === boundStep.label;
        return (
          <span
            key={step.label}
            className={styles.step}
            data-bound={bound ? "" : undefined}
            data-oog={step.oog ? "" : undefined}
            style={{ background: formatOklch(step.color) }}
            aria-current={bound ? "true" : undefined}
            aria-label={`${boundStep.role} ${step.label}${bound ? " — bound" : ""}${step.oog ? ", out of gamut" : ""}`}
          >
            {bound ? (
              <span className={styles.marker} aria-hidden="true">
                {step.label}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
