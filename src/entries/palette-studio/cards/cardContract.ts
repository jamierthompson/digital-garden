// The per-token card contract — the phase-1 SEAM (#154). For each of the 14 semantic
// tokens it names three things the card copy needs but the engine's token VALUES don't
// carry: the binding KIND (which of the four derivation stories applies), the contrast
// pair the receipt re-measures (which background, against which target), and a short
// human usage line.
//
// This is a faithful local MIRROR of the engine's private `DEFAULT_SCHEMA` + `TARGET`
// (packages/oklch/src/palette.ts) — restated here ONLY because those are not yet exported.
// Engine #150 exports the derivation contract; task #13 then deletes the duplicated
// numbers and reads them from `@garden/oklch` instead — this file is where that swap lands,
// so the rest of the card system never re-couples to the schema. Pure, React-free, DOM-free.

import type { BrandTokenName, ContrastTarget, RampRole } from "@garden/oklch";

/**
 * Which of the four derivation stories (the engine guide's derivation stories) a token follows. A pure function of the
 * token name — the engine's `TokenBinding.kind`. `step` = a pinned surface, `auto` = a
 * `minPass` solve, `accent`/`on-accent` = the continuous co-solve (their provenance is
 * `null`, so the card copy for them lives behind the #151 seam in `derivationCopy`).
 */
export type BindingKind = "step" | "auto" | "accent" | "on-accent";

/** The contrast pair a foreground token is re-measured against (the engine guide's `auto` derivation story). */
export interface ContrastAgainst {
  /** The background token the foreground is measured against (its worst-case surface). */
  readonly bg: BrandTokenName;
  /** The target it must clear — mirrors the engine's `TARGET` entry for this token. */
  readonly target: ContrastTarget;
}

/** Everything the card needs about a token that its color value doesn't carry. */
export interface CardContract {
  readonly kind: BindingKind;
  /** The ramp role a stepped/auto token binds to (for the mini-ramp). `null` for the co-solves. */
  readonly role: RampRole | null;
  /** The contrast pair the receipt re-measures — `null` for surfaces (canvases, not foregrounds). */
  readonly against: ContrastAgainst | null;
  /** A short "where you'd use this" line, derived from the token's role. */
  readonly usage: string;
}

// Targets mirror packages/oklch/src/palette.ts `TARGET` exactly (#150 will export these).
const BODY_TEXT: ContrastTarget = { wcag: 4.5, apca: 75 };
const MUTED_TEXT: ContrastTarget = { wcag: 4.5, apca: 60 };
const ACCENT_TEXT: ContrastTarget = { wcag: 4.5, apca: 60 };
const ON_ACCENT: ContrastTarget = { wcag: 4.5, apca: 60 };
const UI: ContrastTarget = { wcag: 3, apca: 45 };
const BORDER: ContrastTarget = { wcag: 3, apca: 30 };

/** The worst-case surface every foreground is solved against (engine: `surface-2`). */
const WORST_SURFACE: BrandTokenName = "surface-2";

/**
 * The 14-token card contract, in the engine's canonical emission order. Mirrors
 * `DEFAULT_SCHEMA` (palette.ts): surfaces are `step`, readable tokens are `auto` measured
 * on `surface-2`, `on-accent` is measured on the `accent` fill, and `accent`/`on-accent`
 * are the continuous co-solves.
 */
export const CARD_CONTRACT: Record<BrandTokenName, CardContract> = {
  bg: {
    kind: "step",
    role: "neutral",
    against: null,
    usage: "The page canvas — the surface everything else sits on.",
  },
  surface: {
    kind: "step",
    role: "neutral",
    against: null,
    usage: "Raised surfaces — cards, panels, and wells above the page.",
  },
  "surface-2": {
    kind: "step",
    role: "neutral",
    against: null,
    usage:
      "The highest surface — popovers and nested cards. Also the worst-case background every foreground is solved against.",
  },
  text: {
    kind: "auto",
    role: "neutral",
    against: { bg: WORST_SURFACE, target: BODY_TEXT },
    usage: "Body copy and headings — anything meant to be read.",
  },
  "text-muted": {
    kind: "auto",
    role: "neutral",
    against: { bg: WORST_SURFACE, target: MUTED_TEXT },
    usage: "Secondary text — captions, metadata, timestamps.",
  },
  border: {
    kind: "auto",
    role: "neutral",
    against: { bg: WORST_SURFACE, target: BORDER },
    usage: "Hairlines, dividers, and input outlines.",
  },
  accent: {
    kind: "accent",
    role: null,
    against: { bg: WORST_SURFACE, target: UI },
    usage: "The primary action — buttons, active states, selected controls.",
  },
  "accent-text": {
    kind: "auto",
    role: "brand",
    against: { bg: WORST_SURFACE, target: ACCENT_TEXT },
    usage: "Brand-colored text — inline links and emphasized labels.",
  },
  "on-accent": {
    kind: "on-accent",
    role: null,
    against: { bg: "accent", target: ON_ACCENT },
    usage: "Text and icons that sit on the accent fill.",
  },
  "focus-ring": {
    kind: "auto",
    role: "brand",
    against: { bg: WORST_SURFACE, target: UI },
    usage: "The keyboard focus indicator around interactive elements.",
  },
  success: {
    kind: "auto",
    role: "success",
    against: { bg: WORST_SURFACE, target: ACCENT_TEXT },
    usage: "Success messages, valid states, confirmations.",
  },
  error: {
    kind: "auto",
    role: "error",
    against: { bg: WORST_SURFACE, target: ACCENT_TEXT },
    usage: "Error messages, invalid input, destructive warnings.",
  },
  warning: {
    kind: "auto",
    role: "warning",
    against: { bg: WORST_SURFACE, target: ACCENT_TEXT },
    usage: "Caution states and non-blocking warnings.",
  },
  info: {
    kind: "auto",
    role: "info",
    against: { bg: WORST_SURFACE, target: ACCENT_TEXT },
    usage: "Informational notices, tips, and neutral callouts.",
  },
};

/**
 * The target as a human phrase — "4.5:1 and Lc 75". Derived from the numbers so the card
 * copy can never disagree with the target it names (the engine guide: the copy must NAME its target).
 */
export function describeTarget(target: ContrastTarget): string {
  return `${formatRatio(target.wcag)}:1 and Lc ${target.apca}`;
}

/** WCAG ratios read as "4.5" / "3", never "4.50" / "3.0". */
function formatRatio(wcag: number): string {
  return Number.isInteger(wcag) ? String(wcag) : wcag.toFixed(1);
}
