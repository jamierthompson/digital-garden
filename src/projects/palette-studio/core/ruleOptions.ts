// The rule catalog the left rail renders — one descriptor per selectable value, each with a
// plain-English consequence line ("nothing is a black box"). The option VALUES are the frozen
// engine unions (`LightnessDistribution` etc.); the labels + hints are UI copy paraphrasing
// the engine type docs (`packages/oklch/src/types.ts`). Single source of truth for the rail.

import type {
  ChromaPolicy,
  Gamut,
  HuePolicy,
  LightnessDistribution,
} from "@garden/oklch";

/** One selectable rule value: its engine value, a short control label, and the one-line
 *  consequence shown when it's the active choice. */
export interface RuleOption<T> {
  readonly value: T;
  readonly label: string;
  readonly hint: string;
}

/** Lightness distribution — reshapes the interior steps 300…700 between pinned shoulders. */
export const DISTRIBUTION_OPTIONS: readonly RuleOption<LightnessDistribution>[] =
  [
    {
      value: "tailwind",
      label: "Tailwind",
      hint: "The hand-shaped default — dense at both ends, three close surfaces each side.",
    },
    {
      value: "linear",
      label: "Linear",
      hint: "An even march through the mid-tones.",
    },
    {
      value: "eased",
      label: "Eased",
      hint: "A smoothstep — gentle at the ends, quicker through the middle.",
    },
    {
      value: "punchy",
      label: "Punchy",
      hint: "A steep mid-section — high contrast between the mid-tones.",
    },
    {
      value: "soft",
      label: "Soft",
      hint: "A low-contrast band, huddled toward the middle.",
    },
  ];

/** Chroma policy — how nominal saturation varies across the ramp. */
export const CHROMA_OPTIONS: readonly RuleOption<ChromaPolicy>[] = [
  {
    value: "flat",
    label: "Flat",
    hint: "Hold the saturation at every step (gamut-mapping still trims what can't fit).",
  },
  {
    value: "taper",
    label: "Taper",
    hint: "Pull saturation out of the lightest and darkest steps.",
  },
  {
    value: "hold",
    label: "Hold",
    hint: "Keep saturation pushing into the dark steps.",
  },
];

/** Hue policy — subtle per-step hue drift. */
export const HUE_OPTIONS: readonly RuleOption<HuePolicy>[] = [
  {
    value: "constant",
    label: "Constant",
    hint: "Hold one hue across the whole ramp.",
  },
  {
    value: "warm-shadows",
    label: "Warm shadows",
    hint: "Drift the darker steps warmer, up to ±9°.",
  },
  {
    value: "cool-highlights",
    label: "Cool highlights",
    hint: "Drift the lighter steps cooler, up to ±9°.",
  },
];

/** Target display gamut — mapped before the contrast math. */
export const GAMUT_OPTIONS: readonly RuleOption<Gamut>[] = [
  {
    value: "srgb",
    label: "sRGB",
    hint: "Safe everywhere — mapped into the sRGB gamut so contrast holds on any screen.",
  },
  {
    value: "p3",
    label: "Display P3",
    hint: "Wide-gamut — richer color on capable displays, clamped elsewhere.",
  },
];

/** Tinted neutrals is a boolean Switch; its two states get consequence lines too. */
export const TINTED_NEUTRALS_HINT = {
  on: "Greys lean gently toward the brand hue — the engine's signature.",
  off: "Pure achromatic greys, no brand tint.",
} as const;
