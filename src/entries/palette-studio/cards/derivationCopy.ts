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
  BindingProvenance,
  FillProvenance,
  OnFillProvenance,
  Scheme,
  StepProvenance,
} from "@garden/oklch";

import type { BindingKind } from "./cardContract";

// Below this |deltaL| a native fill is "kept exactly"; at or above it, it was nudged. The
// engine reports deltaL === 0 for a perfectly faithful solve and ≥ 0.01 for the smallest
// legibility nudge, so this cleanly separates the two branches. It also gates the hover's
// provenance-to-provenance move: below it, the hover is treated as unmoved from the accent.
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
  /** The seed's native scheme (`meta.direction`) — gates the fill's mode-twin wording. */
  readonly direction: Scheme;
  /**
   * The resting-state provenance a `fill-hover` narrates against (accent-hover reads the base
   * `accent` fill's provenance for this scheme). Only set for `fill-hover`; the hover's move is
   * `hover.deltaL − accent.deltaL`, a provenance-to-provenance difference, never a color compare.
   */
  readonly companionProvenance?: BindingProvenance;
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
 * `auto-on` — a label solved against a pinned CONTAINER of the same role (not the worst
 * surface), e.g. `on-error-container` on `error-container` (#160). Plain first, then the shade
 * coordinate and the target; the live measurement lives on the chip.
 */
function autoOnDerivation(input: DerivationInput): string {
  const step = stepOf(input.provenance);
  if (!step) return "Auto-picked to stay readable on its container.";
  const target = input.targetPhrase ?? "its readability target";
  return `Auto-picked to read on the ${step.role} container — the closest shade that stays easy to read on it (the ${step.label} shade of your ${step.role} scale). It has to clear ${target}.`;
}

/**
 * `literal` — a fixed value with no contrast claim (the scrim overlay, #160). The only story a
 * literal carries is its opacity; there is nothing to solve, and saying so plainly is the point.
 */
function literalDerivation(input: DerivationInput): string {
  const prov = input.provenance;
  const alpha = prov?.kind === "literal" ? prov.alpha : 1;
  const pct = Math.round(alpha * 100);
  return `A fixed overlay at ${pct}% opacity — unmeasured by design: an overlay makes no contrast claim, so nothing was solved. It just dims whatever sits behind a dialog or drawer.`;
}

/**
 * `fill` — a co-solved signal fill. Reads `FillProvenance` verbatim. A STATUS fill (`seed:
 * null`) has no brand-seed relationship: it is solved at its own fixed canonical hue. A BRAND
 * fill (`seed` present) is your accent: `seed.native` is the SOLVE PATH (faithful native solve),
 * NOT scheme direction — a native-scheme seed whose faithful solve can't host a label falls
 * through to the derived scan and reports `native: false` in its own native scheme, so the
 * "derived" copy must not claim an other-mode color. The mode-twin wording therefore gates on
 * `meta.direction !== scheme` INDEPENDENTLY of `native`.
 */
export function fillDerivation(
  prov: FillProvenance,
  scheme: Scheme,
  direction: Scheme,
): string {
  if (prov.seed === null) {
    return `Solved at the fixed ${prov.role} hue — the most colorful shade that stands out on the background and can still hold a readable label. It stays ${prov.role} in every palette, so the signal never drifts.`;
  }
  if (scheme !== direction) {
    return `A derived version of your color for ${scheme} mode. Your color is really a ${direction}-mode color, so this is the most colorful shade of it that still stands out here and can hold a readable label.`;
  }
  if (!prov.seed.native) {
    return "Derived — your color's own lightness couldn't hold a readable label, so we searched for the most colorful shade that can.";
  }
  if (Math.abs(prov.seed.deltaL) <= FAITHFUL_DELTA_L) {
    return "Kept at your color's exact lightness — it already stands out on the background, so nothing moved.";
  }
  const towards = prov.seed.deltaL < 0 ? "darker" : "lighter";
  return `Nudged a little ${towards} than your color — the smallest change that keeps a label readable on it.`;
}

/**
 * `fill-hover` — a co-solved interaction-state fill (accent-hover, #160), narrated relative to
 * the RESTING fill it hovers off. The move is `hover.deltaL − base.deltaL` (both signed against
 * the same seed), a provenance-to-provenance difference — never a color comparison. Without the
 * base's provenance (or below the faithful threshold) it falls back to the direction-free line.
 */
export function fillHoverDerivation(
  prov: FillProvenance,
  companion: BindingProvenance,
): string {
  const base = companion?.kind === "fill" ? companion : null;
  if (prov.seed && base?.seed) {
    const move = prov.seed.deltaL - base.seed.deltaL;
    if (Math.abs(move) > FAITHFUL_DELTA_L) {
      const towards = move < 0 ? "darker" : "lighter";
      return `A hover state of your accent — nudged ${towards} than the resting accent, the smallest change that reads as a state change.`;
    }
  }
  return "A hover state of your accent — nudged just enough to read as a state change on hover.";
}

/**
 * `on-fill` — the label that sits on a fill. Reads `OnFillProvenance`: `pole` is the extreme it
 * leans toward; `chroma > 0` is a colorful color-on-color label (#153), `0` a near-white/
 * near-black one. Contrast is mostly about lightness, so even a colorful label lands far from
 * the fill in lightness.
 */
export function onFillDerivation(prov: OnFillProvenance): string {
  const lightDark = prov.pole === "white" ? "light" : "dark";
  return prov.chroma > 0
    ? `A ${lightDark}, colorful label — the most colorful shade that still reads clearly on the fill (contrast is mostly about lightness, so it stays far from the fill in brightness while keeping some color).`
    : `Near-${prov.pole} — whichever of near-white or near-black has more contrast on the fill, so the label has contrast to spare instead of just scraping by.`;
}

/**
 * The derivation sentence for a token in a given scheme — the switch over the seven binding
 * kinds. The one entry point the card face renders; every branch is a pure function of `input`.
 */
export function derivationSentence(input: DerivationInput): string {
  switch (input.cardKind) {
    case "step":
      return stepDerivation(input.provenance);
    case "auto":
      return autoDerivation(input);
    case "auto-on":
      return autoOnDerivation(input);
    case "literal":
      return literalDerivation(input);
    case "fill":
      return input.provenance?.kind === "fill"
        ? fillDerivation(input.provenance, input.scheme, input.direction)
        : "A signal color, chosen to stand out on the background.";
    case "on-fill":
      return input.provenance?.kind === "on-fill"
        ? onFillDerivation(input.provenance)
        : "The text that sits on the fill.";
    case "fill-hover":
      return input.provenance?.kind === "fill"
        ? fillHoverDerivation(
            input.provenance,
            input.companionProvenance ?? null,
          )
        : "A hover state of your accent.";
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
  if (cardKind === "step" || cardKind === "auto" || cardKind === "auto-on") {
    const step = stepOf(otherProvenance);
    return step
      ? `In ${other} mode, this switches to the ${step.label} shade.`
      : `In ${other} mode, this is re-picked for that background.`;
  }
  if (cardKind === "literal") {
    return `In ${other} mode, this overlay is unchanged.`;
  }
  if (cardKind === "on-fill" && otherProvenance?.kind === "on-fill") {
    return `In ${other} mode, the label leans near-${otherProvenance.pole}.`;
  }
  // A status fill has no brand-seed relationship — it's re-solved at its own fixed hue.
  if (otherProvenance?.kind === "fill" && otherProvenance.seed === null) {
    return `In ${other} mode, this fill is re-solved for that background.`;
  }
  // Brand fill / fill-hover (and any co-solve fallback): re-solved against the other background.
  return `In ${other} mode, your color is re-solved for that background.`;
}

/**
 * The out-of-gamut aside — shown only when this token's shade had to lose some color to fit
 * the screen. The engine's sharpest "no black box" line, in plain language.
 */
export function oogNote(): string {
  return "This shade asked for more color than your screen can show at this brightness, so we toned it down the exact way the browser would — then measured contrast on what actually appears, not on the impossible color. Most tools do that backwards.";
}
