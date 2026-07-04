// The derivation sentence — "how this color was made", the receipt at the heart of the
// swatch card (#154). PLAIN LANGUAGE FIRST, term-of-art after: the audience is developers who
// don't know color science, and the tool's promise is teaching. A pure template switching on
// the card's binding KIND (from the schema) and reading the engine's solve-time PROVENANCE
// (#151) — never value-matched.
//
// The card shows ONE scheme (the active one); the other scheme is a one-line counterpart hint
// (`counterpartHint`), read from the other scheme's provenance. Fuller definitions of the
// terms these sentences use live in the card disclosure (see `glossary.ts`). Pure, React-free.

import type {
  AccentProvenance,
  BindingProvenance,
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
  /** The target as a phrase ("4.5:1 and Lc 75") — from `describeTarget`. `null` for surfaces. */
  readonly targetPhrase: string | null;
  /** The seed's native scheme (`meta.direction`) — gates the accent's mode-twin wording. */
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

/**
 * `step` — a fixed background shade. Chosen directly, not by a contrast test; plain first,
 * with the ramp coordinate named after.
 */
function stepDerivation(provenance: BindingProvenance): string {
  const here = stepOf(provenance);
  if (!here) return "A fixed background shade.";
  return `A fixed background shade, picked directly rather than by a contrast test — the ${here.label} shade of your ${here.role} scale.`;
}

/**
 * `auto` — an auto-picked readable shade. Plain first ("closest shade that stays easy to
 * read"), then the named target; the live measurement lives on the contrast chip, not here.
 */
function autoDerivation(input: DerivationInput): string {
  const step = stepOf(input.provenance);
  if (!step) return "Auto-picked to stay readable on the background.";
  const target = input.targetPhrase ?? "its readability target";
  return `Auto-picked — the closest shade to the background that stays easy to read on it (the ${step.label} shade of your ${step.role} scale). It has to clear ${target}.`;
}

/**
 * `accent` — your brand color as an interactive fill. Reads `AccentProvenance` verbatim.
 * `native` is the SOLVE PATH (faithful native solve), NOT scheme direction — a native-scheme
 * seed whose faithful solve can't host a label falls through to the derived scan and reports
 * `native: false` in its own native scheme, so the "derived" copy must not claim an other-mode
 * color. The mode-twin wording therefore gates on `meta.direction !== scheme` INDEPENDENTLY of
 * `native`.
 */
export function accentDerivation(
  prov: AccentProvenance,
  scheme: Scheme,
  direction: Scheme,
): string {
  if (scheme !== direction) {
    return `A derived version of your color for ${scheme} mode. Your color is really a ${direction}-mode color, so this is the most colorful shade of it that still stands out here and can hold a readable label.`;
  }
  if (!prov.native) {
    return "Derived — your color's own lightness couldn't hold a readable label, so we searched for the most colorful shade that can.";
  }
  if (Math.abs(prov.deltaL) <= FAITHFUL_DELTA_L) {
    return "Kept at your color's exact lightness — it already stands out on the background, so nothing moved.";
  }
  const towards = prov.deltaL < 0 ? "darker" : "lighter";
  return `Nudged a little ${towards} than your color — the smallest change that keeps a label readable on it.`;
}

/**
 * `on-accent` — the text that sits on the accent fill. Reads `OnAccentProvenance`: `pole` is
 * the extreme it leans toward; `chroma > 0` is a colorful color-on-color label (#153), `0` a
 * near-white/near-black one. Contrast is mostly about lightness, so even a colorful label
 * lands far from the fill in lightness.
 */
export function onAccentDerivation(prov: OnAccentProvenance): string {
  const lightDark = prov.pole === "white" ? "light" : "dark";
  return prov.chroma > 0
    ? `A ${lightDark}, colorful label — the most colorful shade that still reads clearly on the fill (contrast is mostly about lightness, so it stays far from the fill in brightness while keeping some color).`
    : `Near-${prov.pole} — whichever of near-white or near-black has more contrast on the fill, so the label has contrast to spare instead of just scraping by.`;
}

/**
 * The derivation sentence for a token in a given scheme — the switch over the four binding
 * kinds. The one entry point the card face renders; every branch is a pure function of `input`.
 */
export function derivationSentence(input: DerivationInput): string {
  switch (input.cardKind) {
    case "step":
      return stepDerivation(input.provenance);
    case "auto":
      return autoDerivation(input);
    case "accent":
      return input.provenance?.kind === "accent"
        ? accentDerivation(input.provenance, input.scheme, input.direction)
        : "Your brand color, chosen to stand out on the background.";
    case "on-accent":
      return input.provenance?.kind === "on-accent"
        ? onAccentDerivation(input.provenance)
        : "The text that sits on the accent fill.";
  }
}

/**
 * The one-line counterpart hint — what this token becomes in the OTHER color scheme, read from
 * that scheme's provenance (never value-matched). Replaces the old both-scheme facet now that
 * cards show a single scheme (the site-wide #133 toggle is how users compare the two).
 */
export function counterpartHint(
  cardKind: BindingKind,
  scheme: Scheme,
  otherProvenance: BindingProvenance,
): string {
  const other = otherScheme(scheme);
  if (cardKind === "step" || cardKind === "auto") {
    const step = stepOf(otherProvenance);
    return step
      ? `In ${other} mode, this switches to the ${step.label} shade.`
      : `In ${other} mode, this is re-picked for that background.`;
  }
  if (cardKind === "on-accent" && otherProvenance?.kind === "on-accent") {
    return `In ${other} mode, the label leans near-${otherProvenance.pole}.`;
  }
  // accent (and any co-solve fallback): it is re-solved against the other scheme's background.
  return `In ${other} mode, your color is re-solved for that background.`;
}

/**
 * The out-of-gamut aside — shown only when this token's shade had to lose some color to fit
 * the screen. The engine's sharpest "no black box" line, in plain language.
 */
export function oogNote(): string {
  return "This shade asked for more color than your screen can show at this brightness, so we toned it down the exact way the browser would — then measured contrast on what actually appears, not on the impossible color. Most tools do that backwards.";
}
