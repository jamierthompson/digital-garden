// The derivation sentence — "how this color was derived", the receipt at the heart of the
// swatch card (#154). A pure template switching on the card's binding KIND (from the schema)
// and reading the engine's solve-time PROVENANCE (#151) — never value-matched. Because every
// input is a pure function of the engine's `TokenSet`, the copy regenerates on every
// seed/rules change for free.
//
// Note the two kinds are distinct: `auto` tokens carry `StepProvenance` (kind "step") just
// like pinned surfaces — the ramp coordinate is the same shape — so the copy branch is chosen
// by the schema `cardKind` (step vs auto), while the `(role, label)` is read off the step
// provenance. `accent`/`on-accent` carry their own first-class co-solve reports. Pure,
// React-free, DOM-free.

import type {
  AccentProvenance,
  BindingProvenance,
  ContrastCheck,
  OnAccentProvenance,
  Scheme,
  StepProvenance,
} from "@garden/oklch";

import type { BindingKind } from "./cardContract";

// Below this |deltaL| a native accent is "kept exactly"; at or above it, it was nudged. The
// engine reports deltaL === 0 for a perfectly faithful solve and ≥ 0.01 for the smallest
// legibility nudge, so this cleanly separates the two branches.
const FAITHFUL_DELTA_L = 0.005;

/** Everything a derivation sentence can need, resolved for the scheme being described. */
export interface DerivationInput {
  /** The schema binding kind — chooses the copy branch (step vs auto vs the co-solves). */
  readonly cardKind: BindingKind;
  /** The scheme this sentence describes (the card's active face). */
  readonly scheme: Scheme;
  /** This scheme's solve-time provenance (the real engine report). */
  readonly provenance: BindingProvenance;
  /** The OTHER scheme's provenance — the "flips to …" half of the surface story. */
  readonly otherProvenance: BindingProvenance;
  /** The live contrast measurement for this token, or `null` for a surface (a canvas). */
  readonly measured: ContrastCheck | null;
  /** The target as a phrase ("4.5:1 and Lc 75") — from `describeTarget`. `null` for surfaces. */
  readonly targetPhrase: string | null;
  /** The seed's native scheme (`meta.direction`) — gates the accent's mode-twin headline. */
  readonly direction: Scheme;
}

/** The other scheme's name — "dark" for a light face, and vice versa. */
function otherScheme(scheme: Scheme): Scheme {
  return scheme === "light" ? "dark" : "light";
}

/** A step provenance as the card prints it — "neutral · 800". */
export function formatStep(step: StepProvenance): string {
  return `${step.role} · ${step.label}`;
}

/** The step coordinate of a provenance, or `null` when it isn't a discrete step. */
export function stepOf(provenance: BindingProvenance): StepProvenance | null {
  return provenance?.kind === "step" ? provenance : null;
}

/** The measured pair as a compact receipt — "9.3:1 · Lc 84". */
function formatMeasured(measured: ContrastCheck): string {
  return `${measured.wcag.toFixed(1)}:1 · Lc ${measured.apca.toFixed(0)}`;
}

/**
 * `step` — a pinned surface. Chosen directly rather than contrast-solved; the per-scheme flip
 * IS the dark-mode re-solve, so the sentence names both ends.
 */
function stepDerivation(input: DerivationInput): string {
  const here = stepOf(input.provenance);
  if (!here) return "A fixed surface step.";
  const base = `Pinned to ${formatStep(here)} — a fixed surface step, chosen directly rather than contrast-solved.`;
  const other = stepOf(input.otherProvenance);
  if (!other) return base;
  return `${base} Its ${otherScheme(input.scheme)}-scheme counterpart flips to ${formatStep(other)}.`;
}

/**
 * `auto` — a `minPass` token. Binds to the least-extreme ramp step that clears its target
 * against the worst-case surface; the sentence names the target and the live measurement.
 */
function autoDerivation(input: DerivationInput): string {
  const step = stepOf(input.provenance);
  if (!step) return "Solved against the worst-case surface.";
  const target = input.targetPhrase ?? "its target";
  const base = `Bound to ${formatStep(step)} — the closest step to your surface that clears ${target} against the worst-case surface (surface-2).`;
  if (!input.measured) return base;
  return `${base} Measured: ${formatMeasured(input.measured)}.`;
}

/**
 * `accent` — the one continuous co-solve. Reads the engine's `AccentProvenance` verbatim.
 * `native` is the SOLVE PATH (faithful native solve), NOT scheme direction — a native-scheme
 * seed whose faithful solve can't host a label falls through to the derived scan and reports
 * `native: false` in its own native scheme, so the "derived" copy must not claim an other-mode
 * seed. The "your seed is a {direction}-mode color" headline therefore gates on
 * `meta.direction !== scheme` INDEPENDENTLY of `native`.
 */
export function accentDerivation(
  prov: AccentProvenance,
  scheme: Scheme,
  direction: Scheme,
): string {
  // Off the native scheme → always a derived twin; lead with the mode headline.
  if (scheme !== direction) {
    return `Your seed is a ${direction}-mode color; this is its derived ${scheme}-mode twin — the most saturated lightness that stays visible on the surface and can still host a legible label.`;
  }
  // In the seed's native scheme but the faithful solve fell through → derived, no headline.
  if (!prov.native) {
    return "Derived — your seed's own lightness couldn't host a legible label, so we scanned for the most saturated lightness that stays visible on the surface and can.";
  }
  // Faithful native solve: kept exactly, or nudged the minimum for a legible label.
  if (Math.abs(prov.deltaL) <= FAITHFUL_DELTA_L) {
    return "Kept at your seed's exact lightness — it already reads as a UI element on the worst-case surface, so nothing was moved.";
  }
  const towards = prov.deltaL < 0 ? "darker" : "lighter";
  return `Nudged ${towards} from your seed's lightness by the minimum needed for a label to stay legible on it — as faithful to your color as a readable fill allows.`;
}

/**
 * `on-accent` — the label with headroom. Reads `OnAccentProvenance`: `pole` is the extreme it
 * sits toward; `chroma > 0` is the chromatic color-on-color label (#153, gold-on-navy), `0`
 * the achromatic extreme. Contrast is lightness contrast, so a chromatic label still lands far
 * from the fill in lightness — what the solve wins is the hue the gamut allows there.
 */
export function onAccentDerivation(
  prov: OnAccentProvenance,
  measured: ContrastCheck | null,
): string {
  const lightDark = prov.pole === "white" ? "light" : "dark";
  const base =
    prov.chroma > 0
      ? `A ${lightDark}, saturated label — the most chromatic color that still clears its target on your accent fill (contrast is lightness contrast, so it lands far from the fill in lightness while keeping the hue).`
      : `Near-${prov.pole} — the higher-contrast extreme on your accent fill, so the label clears with headroom rather than hugging the floor.`;
  if (!measured) return base;
  return `${base} Measured: ${formatMeasured(measured)}.`;
}

/**
 * The derivation sentence for a token in a given scheme — the switch over the four binding
 * kinds. The one entry point the card renders; every branch is a pure function of `input`.
 */
export function derivationSentence(input: DerivationInput): string {
  switch (input.cardKind) {
    case "step":
      return stepDerivation(input);
    case "auto":
      return autoDerivation(input);
    case "accent":
      return input.provenance?.kind === "accent"
        ? accentDerivation(input.provenance, input.scheme, input.direction)
        : "The brand's continuous accent co-solve.";
    case "on-accent":
      return input.provenance?.kind === "on-accent"
        ? onAccentDerivation(input.provenance, input.measured)
        : "The label solved to sit on the accent fill.";
  }
}

/**
 * The out-of-gamut aside — shown only when this token's bound step had to desaturate to fit
 * the screen. The engine's sharpest "no black box" line.
 */
export function oogNote(): string {
  return "This color can't exist on your screen at this lightness — we desaturated it exactly the way the browser would, then did the contrast math on what actually paints. Most tools do it backwards.";
}
