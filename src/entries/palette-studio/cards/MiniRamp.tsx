"use client";

// The mini ramp strip (#154) — the 11 shades of a token's scale, made explorable. It teaches
// the two-tier model ("this token IS that shade") three ways: a plain caption that says what
// the strip is, a marked/raised bound step, and a live readout that shows whichever shade you
// hover or focus (its number, oklch, hex, and gamut status in plain words).
//
// Interaction: the strip is a roving-tabindex group — one Tab stop, arrow keys (and Home/End)
// move between shades, moving focus and the readout together. Hover drives the same readout.
// The readout is inline and persistent, so there is no transient tooltip to dismiss (WCAG
// 1.4.13 is satisfied by construction, and it never fights the card's own popover).

import { useRef, useState } from "react";

import {
  formatHex,
  formatOklch,
  type BindingStep,
  type Ramp,
} from "@garden/oklch";

import RampStep from "./RampStep";
import styles from "./MiniRamp.module.css";

interface MiniRampProps {
  readonly ramp: Ramp;
  /** The step this token bound to — marked, and the readout's default. */
  readonly boundStep: BindingStep;
  /** The token name — the group's accessible context. */
  readonly tokenName: string;
}

export default function MiniRamp({
  ramp,
  boundStep,
  tokenName,
}: MiniRampProps): React.ReactElement {
  const [activeLabel, setActiveLabel] = useState<string>(boundStep.label);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Re-home the readout on the bound step whenever it changes — e.g. when the viewer's color
  // scheme resolves after the initial render (light → dark re-binds the token to a new shade),
  // or the site-wide toggle flips it. `useState` alone would keep the stale initial shade; this
  // is React's "adjust state during render when a prop changes" pattern.
  const [seenBound, setSeenBound] = useState<string>(boundStep.label);
  if (boundStep.label !== seenBound) {
    setSeenBound(boundStep.label);
    setActiveLabel(boundStep.label);
  }

  const activeIndex = Math.max(
    0,
    ramp.findIndex((s) => s.label === activeLabel),
  );
  const activeStep = ramp[activeIndex];

  // Roving arrow-key navigation: move the active shade and follow it with focus.
  function moveTo(index: number): void {
    const next = Math.min(Math.max(index, 0), ramp.length - 1);
    setActiveLabel(ramp[next].label);
    buttons.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        moveTo(activeIndex + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        moveTo(activeIndex - 1);
        break;
      case "Home":
        moveTo(0);
        break;
      case "End":
        moveTo(ramp.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const isBound = activeStep.label === boundStep.label;

  return (
    <div className={styles.ramp}>
      <p className={styles.caption}>
        The {boundStep.role} scale — 11 shades, lightest to darkest. This token
        is the {boundStep.label} shade.
      </p>
      <div
        className={styles.strip}
        role="group"
        aria-label={`${boundStep.role} scale — arrow keys inspect each shade`}
        onKeyDown={onKeyDown}
      >
        {ramp.map((step, index) => (
          <RampStep
            key={step.label}
            step={step}
            role={boundStep.role}
            bound={step.label === boundStep.label}
            active={index === activeIndex}
            onInspect={() => setActiveLabel(step.label)}
            buttonRef={(el) => {
              buttons.current[index] = el;
            }}
          />
        ))}
      </div>
      <p className={styles.readout}>
        <span className={styles.readoutLabel}>Shade {activeStep.label}</span>
        {isBound ? <span className={styles.here}> · this token</span> : null}
        {" — "}
        {formatOklch(activeStep.color)} · {formatHex(activeStep.color)}
        {activeStep.oog ? (
          <span className={styles.oog}> · toned down to fit your screen</span>
        ) : null}
      </p>
    </div>
  );
}
