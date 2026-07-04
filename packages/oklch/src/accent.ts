/**
 * The accent co-solve: the brand's identity token pair. Unlike the stepped tokens (which
 * bind to a ramp step via `binding.ts`), the accent FILL is a faithful continuous solve
 * anchored at the seed's lightness, and its on-accent LABEL is the most chromatic color that
 * clears on that fill (#153). This module owns both solves plus the solve-time provenance
 * reports (#151) the receipt reads — kept out of `palette.ts` so the orchestrator stays a
 * thin `(brandColor, scheme) → tokens` wiring layer, one concern per module.
 *
 * `solveNativeAccent` honors the seed's own lightness (the native scheme); `solveAccent`
 * derives a legible fill by scanning lightness (the off scheme, and the native fallback).
 * Both are pure, deterministic, and never throw.
 */

import { clamp01 } from "./convert";
import { gamutMap } from "./gamut";
import { apcaLc, checkContrast, withSolveMargin } from "./contrast";
import { CONTRAST_TARGETS } from "./targets";
import type {
  AccentProvenance,
  Gamut,
  OkLCH,
  OnAccentProvenance,
} from "./types";

/** Chroma resolution for the on-accent label solve (#153) and the "backed off below the
 *  seed's chroma" flag (#151) — well above the 4-dp bake error, so both are stable. */
const CHROMA_BACKOFF_EPS = 1e-4;

/** Chroma step for the on-accent label backoff (#153): coarse is fine — chroma barely moves
 *  luminance, so the label's lightness (not this step) dominates whether it clears. */
const LABEL_CHROMA_STEP = 0.02;

/**
 * The on-accent label for a chosen accent fill: the HIGHER-contrast of a near-white and a
 * near-black extreme against the fill. Picking the better polarity (rather than the first
 * that merely clears the floor) is what gives on-accent real headroom — this is how the
 * ramp model absorbs #95: the label is an extreme step, so it clears with margin, not a
 * floor-hugging continuous solve. Both candidates are gamut-mapped so the math matches paint.
 */
function onAccentLabel(accent: OkLCH, hue: number, gamut: Gamut): OkLCH {
  const white = gamutMap({ L: 0.99, C: 0, H: hue }, gamut);
  const black = gamutMap({ L: 0.1, C: 0, H: hue }, gamut);
  return apcaLc(white, accent) >= apcaLc(black, accent) ? white : black;
}

/**
 * The on-accent LABEL (#153): the MOST CHROMATIC color at the brand hue that still clears the
 * on-accent target on the fill — gold on navy, mint on plum, cream on terracotta. The physics:
 * WCAG + APCA contrast are luminance-based, so a legible label always lands far from the fill
 * in LIGHTNESS; what the solve wins is the chroma the gamut allows AT that lightness (dark fills
 * → colorful light labels; light fills → deep colorful darks). It is a STRICT generalization of
 * `onAccentLabel`: that achromatic near-white/near-black extreme is the C→0 limit of the backoff
 * AND the guaranteed-clearing floor, so we search the pole it chose and only REPLACE it when a
 * chromatic label genuinely clears — an achromatic seed (chroma ≤ eps) returns it bit-for-bit,
 * so legibility can never regress. Solve a hair above the floor (#79) so the 4-dp bake still
 * clears; gamut-map every candidate so the math matches paint. Pure, deterministic, never throws.
 */
function chromaticOnAccentLabel(
  accent: OkLCH,
  hue: number,
  chroma: number,
  gamut: Gamut,
): OkLCH {
  // Today's label: the higher-contrast achromatic extreme — the guaranteed floor + the pole.
  const achromatic = onAccentLabel(accent, hue, gamut);
  // No chroma to spend (achromatic seed) → the label IS that extreme, bit-identical to today.
  if (chroma <= CHROMA_BACKOFF_EPS) return achromatic;

  const target = withSolveMargin(CONTRAST_TARGETS.onAccent);
  // The chromatic label sits on the same pole `onAccentLabel` picked (the far side of the fill
  // in lightness — where contrast lives); scan that side for the most chromatic clearing color.
  // Following that pole is a deliberate headroom-FIRST priority: for a balanced mid-lightness
  // fill the opposite pole could occasionally hold marginally more gamut chroma, but the chosen
  // pole is the higher-contrast one (#95) and always clears, so we never trade legibility for it.
  const poleWhite = achromatic.L >= accent.L;
  const loL = poleWhite ? accent.L : 0.1;
  const hiL = poleWhite ? 0.99 : accent.L;

  let best = achromatic;
  let bestChroma = achromatic.C; // ≈ 0 — any clearing chromatic label beats it
  let bestLc = apcaLc(achromatic, accent);

  for (let L = loL; L <= hiL + 1e-9; L += 0.01) {
    // Start at the gamut-max chroma THIS lightness allows (≤ requested), then back off toward
    // grey only as far as the target forces — the label keeps as much brand color as it can.
    const capped = gamutMap({ L, C: chroma, H: hue }, gamut).C;
    for (let C = capped; C > CHROMA_BACKOFF_EPS; C -= LABEL_CHROMA_STEP) {
      const candidate = gamutMap({ L, C, H: hue }, gamut);
      if (!checkContrast(candidate, accent, target).passes) continue;
      const lc = apcaLc(candidate, accent);
      // Prefer the most chromatic label; tie-break on contrast headroom.
      if (
        candidate.C > bestChroma + CHROMA_BACKOFF_EPS ||
        (Math.abs(candidate.C - bestChroma) <= CHROMA_BACKOFF_EPS &&
          lc > bestLc)
      ) {
        best = candidate;
        bestChroma = candidate.C;
        bestLc = lc;
      }
      break; // the first passing C is the most chromatic clearing label at this lightness
    }
  }

  return best;
}

/**
 * Co-solve the accent FILL and the text that sits ON it. A mid-tone fill can host no
 * high-Lc text in either polarity, so we scan the brand hue across lightness for the
 * fill that (a) stays visible on the worst-case surface (≥3:1 + Lc 45, non-text)
 * and (b) lets a near-white OR near-black label clear the on-accent target — preferring
 * the MOST chromatic (most brand-faithful) such fill. The achromatic extremes gate FILL
 * feasibility (a fill that can host one is accepted); the shipped label is then the most
 * chromatic color that clears on that fill (`chromaticOnAccentLabel`, #153 — falling back to
 * the achromatic extreme). Deterministic, always returns a usable pair.
 */
export function solveAccent(
  seed: OkLCH,
  surfaceBg: OkLCH,
  gamut: Gamut,
): { accent: OkLCH; onAccent: OkLCH } {
  const hue = seed.H;
  // Solve to a hair above the floors (#79) so the 4-dp-rounded baked fill + label still
  // clear their true floors — this scan bakes literals just like `solveForeground`.
  const target = withSolveMargin(CONTRAST_TARGETS.onAccent);
  const ui = withSolveMargin(CONTRAST_TARGETS.ui);
  const labels = [
    gamutMap({ L: 0.99, C: 0, H: hue }, gamut), // near-white
    gamutMap({ L: 0.1, C: 0, H: hue }, gamut), // near-black
  ];

  let best: {
    accent: OkLCH;
    onAccent: OkLCH;
    chroma: number;
    lc: number;
  } | null = null;
  let fallback: { accent: OkLCH; onAccent: OkLCH; lc: number } | null = null;

  for (let L = 0.3; L <= 0.8 + 1e-9; L += 0.01) {
    const accent = gamutMap({ L, C: seed.C, H: hue }, gamut);
    // The fill must read as a UI element against the surface (non-text 3:1 / Lc 45).
    if (!checkContrast(accent, surfaceBg, ui).passes) continue;

    for (const label of labels) {
      const check = checkContrast(label, accent, target);
      const lc = check.apca;
      // Track the overall best label/fill in case nothing meets target (unreachable).
      if (!fallback || lc > fallback.lc)
        fallback = { accent, onAccent: label, lc };

      if (check.passes) {
        // Prefer the most chromatic fill; tie-break on label contrast margin.
        if (
          !best ||
          accent.C > best.chroma + 1e-4 ||
          (Math.abs(accent.C - best.chroma) <= 1e-4 && lc > best.lc)
        ) {
          best = { accent, onAccent: label, chroma: accent.C, lc };
        }
      }
    }
  }

  if (best)
    return {
      accent: best.accent,
      onAccent: chromaticOnAccentLabel(best.accent, hue, seed.C, gamut),
    };
  // Should be unreachable, but never return undefined — defensive.
  if (fallback)
    return {
      accent: fallback.accent,
      onAccent: chromaticOnAccentLabel(fallback.accent, hue, seed.C, gamut),
    };
  const accent = gamutMap(
    { L: surfaceBg.L >= 0.5 ? 0.45 : 0.7, C: seed.C, H: hue },
    gamut,
  );
  return {
    accent,
    onAccent: chromaticOnAccentLabel(accent, hue, seed.C, gamut),
  };
}

/**
 * NATIVE-scheme accent — FAITHFUL to the seed's own lightness. Anchor the fill at
 * `seed.L` (the per-scheme dampened `seed.C`), verify it still reads as a UI element on
 * the worst-case surface, and host a legible on-accent label (the chromatic solve #153, which
 * degrades to the near-white/near-black extreme). When a mid-lightness `seed.L` can host no
 * label, nudge L minimally toward the nearer extreme
 * (away from mid) — staying as close to `seed.L` as possible — until a label clears while
 * the UI floor still holds. Returns `null` if nothing works (so the caller falls back to
 * the derived scan); this should not happen for a genuinely native seed. Never throws.
 */
export function solveNativeAccent(
  seed: OkLCH,
  surfaceBg: OkLCH,
  gamut: Gamut,
): { accent: OkLCH; onAccent: OkLCH } | null {
  const hue = seed.H;
  // Solve to a hair above the floors (#79) so the rounded baked fill + label still clear.
  const target = withSolveMargin(CONTRAST_TARGETS.onAccent);
  const ui = withSolveMargin(CONTRAST_TARGETS.ui);
  const labels = [
    gamutMap({ L: 0.99, C: 0, H: hue }, gamut), // near-white
    gamutMap({ L: 0.1, C: 0, H: hue }, gamut), // near-black
  ];
  // Nudge toward the pole OPPOSITE the surface — darker on a light surface, lighter on a
  // dark one — so the fill keeps contrast against its worst-case surface (the constraint
  // that actually binds) while a near-white/near-black label gains contrast on it. This
  // mirrors solveForeground's polarity (contrast.ts). delta 0 = fully faithful to seed.L.
  const sign = surfaceBg.L >= 0.5 ? -1 : 1;

  for (let delta = 0; delta <= 0.5 + 1e-9; delta += 0.01) {
    const L = clamp01(seed.L + sign * delta);
    const accent = gamutMap({ L, C: seed.C, H: hue }, gamut);
    // The fill must still read as a UI element against the worst-case surface.
    if (checkContrast(accent, surfaceBg, ui).passes) {
      // Accept this (faithful) fill as soon as SOME extreme label clears the floor, but
      // ship the higher-contrast extreme so on-accent has headroom (#95).
      const hosts = labels.some(
        (label) => checkContrast(label, accent, target).passes,
      );
      if (hosts)
        return {
          accent,
          onAccent: chromaticOnAccentLabel(accent, hue, seed.C, gamut),
        };
    }
    // Once L pins to an extreme, further deltas can't move it — stop scanning.
    if (L <= 0 || L >= 1) break;
  }

  return null;
}

/**
 * Report the accent FILL co-solve (#151): whether the fill came from the FAITHFUL native
 * solve (`native` — it then honors `seed.L`, nudged at most minimally) vs the derived scan,
 * and the signed `accent.L − seed.L` (0 = perfectly faithful; a small magnitude when native
 * = the legibility nudge; just the L delta when derived). A pure function of the
 * already-solved colors + which path ran — reporting only, no value is perturbed.
 */
export function describeAccent(
  accent: OkLCH,
  seed: OkLCH,
  native: boolean,
): AccentProvenance {
  return { kind: "accent", native, deltaL: accent.L - seed.L };
}

/**
 * Report the on-accent LABEL co-solve (#151, carrying the #153 label solve): which extreme
 * the label sits toward relative to the fill (`pole` — near-white vs near-black headroom
 * polarity, #95), the label's own hue/chroma, and whether its chroma was backed off below
 * the seed's (the achromatic extreme is the C→0 limit, so a chromatic seed's achromatic
 * label reports `true`). A pure function of the solved colors — reporting only.
 */
export function describeOnAccent(
  onAccent: OkLCH,
  accent: OkLCH,
  seed: OkLCH,
): OnAccentProvenance {
  return {
    kind: "on-accent",
    pole: onAccent.L >= accent.L ? "white" : "black",
    hue: seed.H,
    chroma: onAccent.C,
    backedOff: onAccent.C + CHROMA_BACKOFF_EPS < seed.C,
  };
}
