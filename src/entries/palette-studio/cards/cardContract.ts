// The per-token card contract (#154). For each of the 14 semantic tokens it answers three
// things the card copy needs but the token VALUE doesn't carry: the binding KIND (which of
// the four derivation stories applies), the contrast pair the receipt re-measures (which
// background, against which target), and a short human usage line.
//
// The kind, the ramp role, and each `auto` token's target are READ from the engine's
// exported `DEFAULT_BINDING_SCHEMA` + `CONTRAST_TARGETS` (#150) — by identity, never restated,
// so the card and the solver can never drift. Only the card-presentation facts the engine
// schema doesn't hold live here: the usage line, which background a foreground is measured
// against, and the two co-solve measurement targets. Pure, React-free, DOM-free.

import {
  CONTRAST_TARGETS,
  DEFAULT_BINDING_SCHEMA,
  BRAND_TOKEN_NAMES,
  type BrandTokenName,
  type ContrastTarget,
  type RampRole,
} from "@garden/oklch";

/**
 * Which of the four derivation stories a token follows — the engine binding's `kind`, minus
 * `literal` (no default token is a literal; the card system has no template for one, so we
 * assert against it rather than silently render nothing).
 */
export type BindingKind = "step" | "auto" | "accent" | "on-accent";

/** The contrast pair a foreground token is re-measured against (the `auto`/co-solve receipt). */
export interface ContrastAgainst {
  /** The background token the foreground is measured against (its worst-case surface / fill). */
  readonly bg: BrandTokenName;
  /** The target it must clear — the engine's own `CONTRAST_TARGETS` tier, by identity. */
  readonly target: ContrastTarget;
}

/** Everything the card needs about a token that its color value doesn't carry. */
export interface CardContract {
  readonly kind: BindingKind;
  /** The ramp role a stepped/auto token binds to (for the mini-ramp). `null` for the co-solves. */
  readonly role: RampRole | null;
  /** The contrast pair the receipt re-measures — `null` for surfaces (canvases, not foregrounds). */
  readonly against: ContrastAgainst | null;
  /** A short "where you'd use this" line. */
  readonly usage: string;
}

// Card-presentation copy the engine schema doesn't carry: where each token is used.
const USAGE: Record<BrandTokenName, string> = {
  bg: "The page canvas — the surface everything else sits on.",
  surface: "Raised surfaces — cards, panels, and wells above the page.",
  "surface-2":
    "The highest surface — popovers and nested cards. Also the worst-case background every foreground is solved against.",
  text: "Body copy and headings — anything meant to be read.",
  "text-muted": "Secondary text — captions, metadata, timestamps.",
  border: "Hairlines, dividers, and input outlines.",
  accent: "The primary action — buttons, active states, selected controls.",
  "accent-text": "Brand-colored text — inline links and emphasized labels.",
  "on-accent": "Text and icons that sit on the accent fill.",
  "focus-ring": "The keyboard focus indicator around interactive elements.",
  success: "Success messages, valid states, confirmations.",
  error: "Error messages, invalid input, destructive warnings.",
  warning: "Caution states and non-blocking warnings.",
  info: "Informational notices, tips, and neutral callouts.",
};

// Which background each foreground is measured against (a card-display choice, not in the
// schema). Absent → a surface: a canvas, not a foreground, so it has no contrast receipt.
const MEASURE_BG: Partial<Record<BrandTokenName, BrandTokenName>> = {
  text: "surface-2",
  "text-muted": "surface-2",
  border: "surface-2",
  "accent-text": "surface-2",
  "focus-ring": "surface-2",
  success: "surface-2",
  error: "surface-2",
  warning: "surface-2",
  info: "surface-2",
  // The accent FILL reads as a UI element on the worst-case surface (UI floor)…
  accent: "surface-2",
  // …and its label is measured on the fill it sits on.
  "on-accent": "accent",
};

// The measurement target for the continuous co-solves (the `auto` tokens read their own
// schema target). Both reference `CONTRAST_TARGETS` by identity — no restated numbers.
const COSOLVE_TARGET: Partial<Record<BrandTokenName, ContrastTarget>> = {
  accent: CONTRAST_TARGETS.ui,
  "on-accent": CONTRAST_TARGETS.onAccent,
};

/** The engine binding's kind, narrowed to the four the card system renders. */
function kindOf(name: BrandTokenName): BindingKind {
  const kind = DEFAULT_BINDING_SCHEMA[name].kind;
  if (kind === "literal") {
    throw new Error(
      `no card derivation template for a literal binding: ${name}`,
    );
  }
  return kind;
}

/** The ramp role the token binds to, or `null` for the roleless co-solves. */
function roleOf(name: BrandTokenName): RampRole | null {
  const binding = DEFAULT_BINDING_SCHEMA[name];
  return "role" in binding ? binding.role : null;
}

/** The contrast pair to re-measure, sourced from the schema target (auto) or the co-solve tier. */
function againstOf(name: BrandTokenName): ContrastAgainst | null {
  const bg = MEASURE_BG[name];
  if (!bg) return null;
  const binding = DEFAULT_BINDING_SCHEMA[name];
  const target =
    binding.kind === "auto" ? binding.target : COSOLVE_TARGET[name];
  return target ? { bg, target } : null;
}

/** The 14-token card contract, derived from the engine schema in canonical emission order. */
export const CARD_CONTRACT: Record<BrandTokenName, CardContract> =
  Object.fromEntries(
    BRAND_TOKEN_NAMES.map((name) => [
      name,
      {
        kind: kindOf(name),
        role: roleOf(name),
        against: againstOf(name),
        usage: USAGE[name],
      },
    ]),
  ) as Record<BrandTokenName, CardContract>;

/**
 * The target as a human phrase — "4.5:1 and Lc 75". Derived from the numbers so the card
 * copy can never disagree with the target it names (the copy must NAME its target).
 */
export function describeTarget(target: ContrastTarget): string {
  return `${formatRatio(target.wcag)}:1 and Lc ${target.apca}`;
}

/** WCAG ratios read as "4.5" / "3", never "4.50" / "3.0". */
function formatRatio(wcag: number): string {
  return Number.isInteger(wcag) ? String(wcag) : wcag.toFixed(1);
}
