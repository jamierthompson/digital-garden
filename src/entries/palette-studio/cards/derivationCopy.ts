// The derivation sentence — "how this color was derived", the receipt at the heart of the
// swatch card (#154). A pure template function switching on the four binding kinds (guide
// §4). Because every input is a pure function of the engine's `TokenSet`, the copy
// regenerates on every seed/rules change for free — "the message changes with the seed".
//
// SEAM (task #13): the `accent` / `on-accent` stories are the two whose engine provenance
// is still `null` (#151). Their copy here is derived from the resolved VALUES (ΔL vs the
// seed, which extreme won) — the reverse-engineering the provenance principle warns against
// (guide §3). It is deliberately quarantined in `accentDerivation` / `onAccentDerivation`
// so #151's first-class co-solve report swaps straight in without touching the `step`/`auto`
// stories, which are already provenance-truthful. Pure, React-free, DOM-free.

import type { BindingStep, ContrastCheck, Scheme } from "@garden/oklch";

import type { BindingKind } from "./cardContract";

/** How faithful the accent stayed to the seed's lightness — the phase-1 value-derived split. */
export type AccentFidelity = "faithful" | "nudged" | "derived";

/** Everything a derivation sentence can need, resolved for the scheme being described. */
export interface DerivationInput {
  readonly kind: BindingKind;
  /** The scheme this sentence describes (the card's active face). */
  readonly scheme: Scheme;
  /** This scheme's binding step (`null` for the accent co-solves). */
  readonly boundStep: BindingStep | null;
  /** The OTHER scheme's binding step — the "flips to …" half of the surface story. */
  readonly otherStep: BindingStep | null;
  /** The live contrast measurement for this token, or `null` for a surface (a canvas). */
  readonly measured: ContrastCheck | null;
  /** The target as a phrase ("4.5:1 and Lc 75") — from `describeTarget`. `null` for surfaces. */
  readonly targetPhrase: string | null;
  /** The seed's native scheme (`meta.direction`) — the accent story's headline. */
  readonly direction: Scheme;
  /** Phase-1 accent fidelity, derived from ΔL vs the seed (the #151 seam). */
  readonly accentFidelity: AccentFidelity;
  /** Which achromatic extreme the on-accent label landed on (`meta` today: always one of these). */
  readonly onAccentPole: "near-white" | "near-black";
}

/** The other scheme's name — "dark" for a light face, and vice versa. */
function otherScheme(scheme: Scheme): Scheme {
  return scheme === "light" ? "dark" : "light";
}

/** A `(role, label)` step as the card prints it — "neutral · 800". */
export function formatStep(step: BindingStep): string {
  return `${step.role} · ${step.label}`;
}

/** The measured pair as a compact receipt — "9.3:1 · Lc 84". */
function formatMeasured(measured: ContrastCheck): string {
  return `${measured.wcag.toFixed(1)}:1 · Lc ${measured.apca.toFixed(0)}`;
}

/**
 * `step` — a pinned surface (guide §4). Chosen directly rather than contrast-solved; the
 * per-scheme flip IS the dark-mode re-solve, so the sentence names both ends.
 */
function stepDerivation(input: DerivationInput): string {
  if (!input.boundStep) return "A fixed surface step.";
  const here = formatStep(input.boundStep);
  const base = `Pinned to ${here} — a fixed surface step, chosen directly rather than contrast-solved.`;
  if (!input.otherStep) return base;
  return `${base} Its ${otherScheme(input.scheme)}-scheme counterpart flips to ${formatStep(input.otherStep)}.`;
}

/**
 * `auto` — a `minPass` token (guide §4). Binds to the least-extreme ramp step that clears
 * its target against the worst-case surface; the sentence names the target and the live
 * measurement, so it is honest proof, not a claim.
 */
function autoDerivation(input: DerivationInput): string {
  if (!input.boundStep) return "Solved against the worst-case surface.";
  const step = formatStep(input.boundStep);
  const target = input.targetPhrase ?? "its target";
  const base = `Bound to ${step} — the closest step to your surface that clears ${target} against the worst-case surface (surface-2).`;
  if (!input.measured) return base;
  return `${base} Measured: ${formatMeasured(input.measured)}.`;
}

/**
 * `accent` — the one continuous co-solve (guide §4). SEAM: branches on `direction` +
 * `accentFidelity` (phase-1 value-derived; #151 replaces `accentFidelity` with the engine's
 * co-solve report). The most chromatic lightness that stays visible on the surface AND can
 * host a legible label.
 */
export function accentDerivation(input: DerivationInput): string {
  if (input.scheme !== input.direction) {
    return `Your seed is a ${input.direction}-mode color; this is its derived ${input.scheme}-mode twin — the most saturated lightness that stays visible on the surface and can still host a legible label.`;
  }
  if (input.accentFidelity === "faithful") {
    return "Kept at your seed's exact lightness — it already reads as a UI element on the worst-case surface, so nothing was moved.";
  }
  // nudged
  return "Nudged off your seed's lightness by the minimum needed for a label to stay legible on it — as faithful to your color as a readable fill allows.";
}

/**
 * `on-accent` — the label with headroom (guide §4). SEAM: the winning pole is read from the
 * resolved value today (achromatic-only); #153 makes it chromatic and #151 carries its
 * provenance. Whichever extreme has MORE contrast on the fill, so the label clears with margin.
 */
export function onAccentDerivation(input: DerivationInput): string {
  const pole = input.onAccentPole;
  const base = `${pole === "near-white" ? "Near-white" : "Near-black"} — the higher-contrast extreme on your accent fill, so the label clears with headroom rather than hugging the floor.`;
  if (!input.measured) return base;
  return `${base} Measured: ${formatMeasured(input.measured)}.`;
}

/**
 * The derivation sentence for a token in a given scheme — the switch over the four binding
 * kinds. The one entry point the card renders; every branch is a pure function of `input`.
 */
export function derivationSentence(input: DerivationInput): string {
  switch (input.kind) {
    case "step":
      return stepDerivation(input);
    case "auto":
      return autoDerivation(input);
    case "accent":
      return accentDerivation(input);
    case "on-accent":
      return onAccentDerivation(input);
  }
}

/**
 * The out-of-gamut aside (guide §6) — shown only when this token's bound step had to
 * desaturate to fit the screen. The engine's sharpest "no black box" line.
 */
export function oogNote(): string {
  return "This color can't exist on your screen at this lightness — we desaturated it exactly the way the browser would, then did the contrast math on what actually paints. Most tools do it backwards.";
}
