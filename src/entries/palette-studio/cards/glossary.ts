// Plain-language definitions for the terms of art the card copy uses (#154). The card face
// keeps copy plain-first; the fuller "what does that word mean" definitions live in the card
// disclosure — the reasoning-chain pattern, where a curious dev drills in. Pure, React-free.
//
// One source of truth for the vocabulary, so the same words never get two different
// explanations across the studio.

export interface GlossaryEntry {
  /** The term as it appears on the card. */
  readonly term: string;
  /** A one- or two-sentence plain-language definition. */
  readonly definition: string;
}

const RAMP: GlossaryEntry = {
  term: "Scale (ramp)",
  definition:
    "An 11-shade scale from lightest to darkest, all the same hue — like a strip of paint chips. Every color on the card is picked from one of these.",
};

const STEP: GlossaryEntry = {
  term: "Shade / step",
  definition:
    "Each shade on a scale is numbered 50 (lightest) to 950 (darkest), Tailwind-style. A bigger number is a darker shade.",
};

const WCAG: GlossaryEntry = {
  term: "Contrast ratio (WCAG)",
  definition:
    "The classic contrast score, from 1:1 to 21:1. 4.5:1 is the readability floor for normal text; 3:1 covers large text, borders, and UI.",
};

const APCA: GlossaryEntry = {
  term: "Lc (APCA)",
  definition:
    "A newer contrast score that tracks how the eye actually reads text (0–106). Rough guide: Lc 75 is body-text quality, Lc 45 is large-text or UI quality.",
};

const WORST_SURFACE: GlossaryEntry = {
  term: "Worst-case surface",
  definition:
    "The mid-tone background this color is hardest to read on. Pass there and it passes on every lighter and darker surface too — that's how one check guarantees readability everywhere.",
};

const OUT_OF_GAMUT: GlossaryEntry = {
  term: "Out of gamut",
  definition:
    "A color more saturated than your screen can actually show. The engine tones it down to fit — the same way your browser silently would — before measuring contrast, so the numbers match what you see.",
};

/**
 * The relevant definitions for a card's disclosure: the scale + shade vocabulary always;
 * the two contrast scores + the worst-case surface only when the card carries a measurement;
 * the out-of-gamut note only when a shade had to be toned down.
 */
export function glossaryFor(opts: {
  readonly measured: boolean;
  readonly oog: boolean;
}): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [RAMP, STEP];
  if (opts.measured) entries.push(WCAG, APCA, WORST_SURFACE);
  if (opts.oog) entries.push(OUT_OF_GAMUT);
  return entries;
}
