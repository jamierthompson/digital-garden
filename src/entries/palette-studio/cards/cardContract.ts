// The per-token card contract (#154, extended to the 34-token model in #160). For each
// semantic token it answers three things the card copy needs but the token VALUE doesn't
// carry: the binding KIND (which of the seven derivation stories applies), the contrast pair
// the receipt re-measures (which background, against which target), and a short human usage line.
//
// The kind, the ramp role, and each `auto`/`auto-on` token's target are READ from the engine's
// exported `DEFAULT_BINDING_SCHEMA` + `CONTRAST_TARGETS` (#150) — by identity, never restated,
// so the card and the solver can never drift. Only the card-presentation facts the engine
// schema doesn't hold live here: the usage line, which background a foreground is measured
// against, and the tier the co-solved fills/labels are measured at. Pure, React-free, DOM-free.

import {
  CONTRAST_TARGETS,
  DEFAULT_BINDING_SCHEMA,
  BRAND_TOKEN_NAMES,
  type BrandTokenName,
  type ContrastTarget,
  type RampRole,
} from "@garden/oklch";

/**
 * Which derivation story a token follows — the engine binding's `kind` (the schema's seven,
 * #160). `step` pins a ramp step; `auto`/`auto-on` land the least-extreme readable step (against
 * the worst surface / a pinned container); `fill`/`on-fill` are the co-solved fills and their
 * labels; `fill-hover` a co-solved interaction-state fill (accent-hover); `literal` a fixed value
 * with no contrast claim (scrim). The card renders every one — no kind is asserted-against.
 */
export type BindingKind =
  | "step"
  | "auto"
  | "auto-on"
  | "literal"
  | "fill"
  | "on-fill"
  | "fill-hover";

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
  "surface-2": "The highest surface — popovers and nested cards.",
  text: "Body copy and headings — anything meant to be read.",
  "text-muted": "Secondary text — captions, metadata, timestamps.",
  border: "Hairlines, dividers, and input outlines.",
  accent: "The primary action — buttons, active states, selected controls.",
  "accent-text": "Brand-colored text — inline links and emphasized labels.",
  "on-accent": "Text and icons that sit on the accent fill.",
  "focus-ring": "The keyboard focus indicator around interactive elements.",
  error: "The error signal fill — destructive buttons, invalid field borders.",
  "on-error": "Text and icons that sit on the error fill.",
  "error-text": "Inline error text on a page surface — validation messages.",
  "error-container":
    "A soft error-tinted surface — alert and banner backgrounds.",
  "on-error-container": "Text and icons inside an error container.",
  warning: "The warning signal fill — caution buttons and badges.",
  "on-warning": "Text and icons that sit on the warning fill.",
  "warning-text": "Inline warning text on a page surface.",
  "warning-container": "A soft warning-tinted surface — caution banners.",
  "on-warning-container": "Text and icons inside a warning container.",
  success: "The success signal fill — confirm buttons and valid badges.",
  "on-success": "Text and icons that sit on the success fill.",
  "success-text": "Inline success text on a page surface — confirmations.",
  "success-container": "A soft success-tinted surface — success banners.",
  "on-success-container": "Text and icons inside a success container.",
  info: "The info signal fill — informational buttons and badges.",
  "on-info": "Text and icons that sit on the info fill.",
  "info-text": "Inline info text on a page surface — neutral notices.",
  "info-container": "A soft info-tinted surface — informational banners.",
  "on-info-container": "Text and icons inside an info container.",
  "accent-hover": "The accent fill on hover — a perceptibly nudged state.",
  "surface-hover":
    "A row or control on hover — one step darker than surface-2 (light).",
  "surface-selected":
    "A selected row or control — the darkest text-bearing surface, and the worst-case background every readable foreground is solved against.",
  scrim: "The dim overlay behind dialogs and drawers.",
};

// The worst-case surface every readable foreground is solved against (#160): the darkest
// text-bearing surface, `surface-selected`. Read from the schema by identity so the card's
// receipt background can never drift from the one the engine actually guaranteed against.
const WORST_SURFACE: BrandTokenName = "surface-selected";

// Which background each foreground is measured against (a card-display choice, not in the
// schema). Absent → a surface / canvas / literal: not a foreground, so no contrast receipt.
// Foregrounds solved against the worst surface use `WORST_SURFACE`; a label on a fill or a
// container is measured on the thing it sits on.
const MEASURE_BG: Partial<Record<BrandTokenName, BrandTokenName>> = {
  // Near-neutral + brand foregrounds — solved against the worst surface.
  text: WORST_SURFACE,
  "text-muted": WORST_SURFACE,
  border: WORST_SURFACE,
  "accent-text": WORST_SURFACE,
  "focus-ring": WORST_SURFACE,
  // Fills read as UI elements on the worst surface (UI floor)…
  accent: WORST_SURFACE,
  "accent-hover": WORST_SURFACE,
  error: WORST_SURFACE,
  warning: WORST_SURFACE,
  success: WORST_SURFACE,
  info: WORST_SURFACE,
  // …and each fill's label is measured on the fill it sits on.
  "on-accent": "accent",
  "on-error": "error",
  "on-warning": "warning",
  "on-success": "success",
  "on-info": "info",
  // Status "-text" tokens are inline text on the worst surface (the honest accent-text tier).
  "error-text": WORST_SURFACE,
  "warning-text": WORST_SURFACE,
  "success-text": WORST_SURFACE,
  "info-text": WORST_SURFACE,
  // A container's label is measured on its own container surface.
  "on-error-container": "error-container",
  "on-warning-container": "warning-container",
  "on-success-container": "success-container",
  "on-info-container": "info-container",
};

// The tier the co-solved fills/labels are measured at — the fixed targets the engine's own
// co-solve uses (a fill lands the `ui` floor, a label the `onAccent` tier). Keyed off the
// KIND, not per-token, and read from `CONTRAST_TARGETS` by identity — no restated numbers.
function cosolveTarget(kind: BindingKind): ContrastTarget | null {
  switch (kind) {
    case "fill":
    case "fill-hover":
      return CONTRAST_TARGETS.ui;
    case "on-fill":
      return CONTRAST_TARGETS.onAccent;
    default:
      return null;
  }
}

/** The engine binding's kind — every schema kind maps 1:1 to a card derivation story. */
function kindOf(name: BrandTokenName): BindingKind {
  return DEFAULT_BINDING_SCHEMA[name].kind;
}

/**
 * The ramp role the token binds to for its mini-ramp — the roles of `step`/`auto`/`auto-on`,
 * which land a discrete step. A co-solved fill (`fill`/`on-fill`/`fill-hover`) carries a role for
 * IDENTITY but does NOT step into that ramp (its provenance is a continuous solve, not a step),
 * so the card shows no mini-ramp for it — `null`, like the roleless `literal`.
 */
function roleOf(name: BrandTokenName): RampRole | null {
  const binding = DEFAULT_BINDING_SCHEMA[name];
  if (
    binding.kind === "fill" ||
    binding.kind === "on-fill" ||
    binding.kind === "fill-hover"
  ) {
    return null;
  }
  return "role" in binding ? binding.role : null;
}

/** The contrast pair to re-measure, sourced from the schema target (auto/auto-on) or the
 *  co-solve tier (fill/on-fill/fill-hover). `null` for surfaces, containers, and the literal. */
function againstOf(name: BrandTokenName): ContrastAgainst | null {
  const bg = MEASURE_BG[name];
  if (!bg) return null;
  const binding = DEFAULT_BINDING_SCHEMA[name];
  const target =
    binding.kind === "auto" || binding.kind === "auto-on"
      ? binding.target
      : cosolveTarget(binding.kind);
  return target ? { bg, target } : null;
}

/**
 * Whether a token belongs to the NEUTRAL family — the greys the card grid sorts to the bottom
 * (owner: chromatic brand + status cards first, neutrals last). Metadata-driven off the engine
 * schema, never a hand-list: the chromatic families (brand + status) each carry their own
 * non-neutral ramp role, the neutral surfaces carry role `"neutral"`, and the scrim is a
 * roleless neutral-hued literal — so "neutral family" is exactly "a neutral role, or no role at
 * all". A new token sorts by its own schema role with no edit here.
 */
export function isNeutralFamily(name: BrandTokenName): boolean {
  const binding = DEFAULT_BINDING_SCHEMA[name];
  return !("role" in binding) || binding.role === "neutral";
}

/** The 34-token card contract, derived from the engine schema in canonical emission order. */
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
