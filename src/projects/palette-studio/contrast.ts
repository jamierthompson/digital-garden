// The read-only contrast receipt's data layer (#106) — pure, React-free. For each readable
// token pair the engine guarantees, it MEASURES the resolved colors with the engine's own
// `checkContrast` (the one "does it clear?" report, #100) and reports the WCAG ratio, APCA
// Lc, and pass mark. It never solves or picks color — it only measures what the engine baked,
// so the receipt is honest proof that the palette can't ship a failing combination.
//
// The targets mirror the WCAG 2.2 AA floors + APCA Lc quality tiers (docs/web-quality.md) the
// engine solves against; they are the accessibility standard, not engine internals.

import {
  checkContrast,
  type BrandTokenName,
  type ContrastTarget,
  type SchemeTokens,
} from "@garden/oklch";

/** One readable pair to measure: a foreground token on a background token, against a target. */
interface ReceiptPair {
  readonly label: string;
  readonly fg: BrandTokenName;
  readonly bg: BrandTokenName;
  readonly target: ContrastTarget;
}

/**
 * The pairs the receipt reports — every readable-on-surface token measured against the
 * worst-case surface (`surface-2`, what the engine solves against), plus the on-accent label
 * on its fill and the focus ring. Foregrounds solved against `surface-2` also clear on `bg`
 * and `surface`, so `surface-2` is the honest worst case to show.
 */
const RECEIPT_PAIRS: readonly ReceiptPair[] = [
  {
    label: "body text",
    fg: "text",
    bg: "surface-2",
    target: { wcag: 4.5, apca: 75 },
  },
  {
    label: "muted text",
    fg: "text-muted",
    bg: "surface-2",
    target: { wcag: 4.5, apca: 60 },
  },
  {
    label: "accent text",
    fg: "accent-text",
    bg: "surface-2",
    target: { wcag: 4.5, apca: 60 },
  },
  {
    label: "on-accent",
    fg: "on-accent",
    bg: "accent",
    target: { wcag: 4.5, apca: 60 },
  },
  {
    label: "focus ring",
    fg: "focus-ring",
    bg: "surface-2",
    target: { wcag: 3, apca: 45 },
  },
];

/** One measured receipt line, ready to render. */
export interface ReceiptRow {
  readonly label: string;
  /** Measured WCAG 2.x ratio (1–21). */
  readonly wcag: number;
  /** Measured APCA Lc magnitude. */
  readonly apca: number;
  /** True when both the WCAG floor and APCA target are cleared. */
  readonly passes: boolean;
  readonly target: ContrastTarget;
}

/** Measure every receipt pair for one scheme's resolved tokens. Pure; never throws. */
export function measureReceipt(tokens: SchemeTokens): ReceiptRow[] {
  return RECEIPT_PAIRS.map((pair) => {
    const { wcag, apca, passes } = checkContrast(
      tokens[pair.fg],
      tokens[pair.bg],
      pair.target,
    );
    return { label: pair.label, wcag, apca, passes, target: pair.target };
  });
}
