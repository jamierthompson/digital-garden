import type { OkLCH } from "./types";

/**
 * Fallback theme seed for unparseable input — the garden pink, in sRGB gamut,
 * chosen so every solved token comfortably clears its target. Deterministic.
 * A safety net only: real surfaces always derive from an authored seed; this
 * paints nothing but garbage input and the build-time baked fallback set.
 */
export const FALLBACK_SEED: OkLCH = { L: 0.66, C: 0.2, H: 350 };
