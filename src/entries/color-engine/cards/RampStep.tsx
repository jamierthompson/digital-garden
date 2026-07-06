// One inspectable step in a MiniRamp (#154). A focusable button whose fill is the baked ramp
// literal; hovering or focusing it drives the ramp's live readout, and its accessible name
// carries the full receipt so assistive tech gets the same info sighted users read below the
// strip. The bound step (the one this token IS) carries a visible marker + `aria-current`.
// Extracted from MiniRamp per the composed-code rule so the strip's keyboard logic stays lean.

import { formatOklch, type Ramp, type RampRole } from "@garden/oklch";

import styles from "./RampStep.module.css";

/** One resolved ramp step (the engine's `RampStep` shape, referenced via `Ramp` to avoid a
 *  name clash with this component). */
type Step = Ramp[number];

interface RampStepProps {
  readonly step: Step;
  readonly role: RampRole;
  /** True for the step this token bound to — marked and `aria-current`. */
  readonly bound: boolean;
  /** True for the roving-tabindex target (the one reachable by Tab). */
  readonly active: boolean;
  /** Called on hover/focus — the strip shows this step in its readout. */
  readonly onInspect: () => void;
  /** Registers the button element so the strip can move focus on arrow keys. */
  readonly buttonRef: (el: HTMLButtonElement | null) => void;
}

export default function RampStep({
  step,
  role,
  bound,
  active,
  onInspect,
  buttonRef,
}: RampStepProps): React.ReactElement {
  const label = `Shade ${step.label} of the ${role} scale${bound ? ", this token" : ""}${
    step.oog ? ", toned down to fit your screen" : ""
  }`;
  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.step}
      style={{ background: formatOklch(step.color) }}
      data-bound={bound ? "" : undefined}
      data-oog={step.oog ? "" : undefined}
      tabIndex={active ? 0 : -1}
      aria-current={bound ? "true" : undefined}
      aria-label={label}
      onMouseEnter={onInspect}
      onFocus={onInspect}
    >
      {bound ? (
        <span className={styles.marker} aria-hidden="true">
          {step.label}
        </span>
      ) : null}
    </button>
  );
}
