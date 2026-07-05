/**
 * The named contrast tiers every solved pair is measured against — the WCAG 2.x floor
 * (legal compliance) paired with the APCA Lc quality target, mirroring the
 * accessibility-and-performance.md table.
 *
 * EXPORTED (#150) so the Studio's per-swatch receipt can NAME a token's target ("clears
 * 4.5:1 and Lc 75") by reading the same table the solver used, rather than restating it — a
 * second copy that silently drifts if these ever change. The default binding schema
 * (`palette.ts`) references these objects by identity, so a token's `target` and this table
 * are one source of truth.
 *
 * Its own module (not `palette.ts`) so BOTH the orchestrator (`palette.ts`, for the schema +
 * direction detection) and the accent co-solve (`accent.ts`) read the tiers without a
 * circular import.
 */

import type { ContrastTarget } from "./contrast";
import { deepFreeze } from "./freeze";

export const CONTRAST_TARGETS = deepFreeze({
  /** Body text: WCAG 4.5 floor, APCA Lc 75 quality target. */
  bodyText: { wcag: 4.5, apca: 75 } satisfies ContrastTarget,
  /** Muted/secondary text: still small-text AA (4.5), lower APCA tier (Lc 60). */
  mutedText: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Link/accent text: AA small-text floor (4.5), Lc 60 — the yellow/cyan stresser. */
  accentText: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Text on the accent fill: AA small-text (4.5) + APCA "non-body" tier (Lc 60). A
   *  mid-tone fill cannot host Lc-75 body text in either polarity, so the on-brand
   *  label target is the non-body tier; the accent fill is co-solved to host it. */
  onAccent: { wcag: 4.5, apca: 60 } satisfies ContrastTarget,
  /** Accent fill, borders, focus ring: non-text 3:1 (1.4.11), Lc 45 spot-readable. The
   *  focus-ring color is an engine token (contrast-solved per slot); ring geometry stays global. */
  ui: { wcag: 3, apca: 45 } satisfies ContrastTarget,
  /** Subtle borders: non-text 3:1 floor. */
  border: { wcag: 3, apca: 30 } satisfies ContrastTarget,
} as const);

/** The named contrast tiers, e.g. `"bodyText"` — the keys of `CONTRAST_TARGETS` (#150). */
export type ContrastTargetName = keyof typeof CONTRAST_TARGETS;
