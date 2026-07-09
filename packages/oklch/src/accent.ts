/**
 * The accent co-solve: the accent's identity token pair. Unlike the stepped tokens (which
 * bind to a ramp step via `binding.ts`), the accent FILL is a faithful continuous solve
 * anchored at the seed's lightness, and its accent-foreground LABEL is the most chromatic color that
 * clears on that fill (#153). This module owns both solves plus the solve-time provenance
 * reports (#151) the receipt reads — kept out of `palette.ts` so the orchestrator stays a
 * thin `(themeColor, scheme) → tokens` wiring layer, one concern per module.
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
  FillProvenance,
  Gamut,
  OkLCH,
  FillForegroundProvenance,
  RampRole,
} from "./types";

/** Chroma resolution for the accent-foreground label solve (#153) and the "backed off below the
 *  seed's chroma" flag (#151) — well above the 4-dp bake error, so both are stable. */
const CHROMA_BACKOFF_EPS = 1e-4;

/** Chroma step for the accent-foreground label backoff (#153): coarse is fine — chroma barely moves
 *  luminance, so the label's lightness (not this step) dominates whether it clears. */
const LABEL_CHROMA_STEP = 0.02;

/** The minimum perceptible lightness nudge for `accent-hover` (#160): where the hover fill
 *  starts scanning off the accent's lightness. ~0.05 OKLCH L reads as a distinct-but-related
 *  state (real hover states move ~3–5% L), while staying anchored to the accent identity. */
const HOVER_DELTA_L = 0.05;

/**
 * The accent-foreground label for a chosen accent fill: the HIGHER-contrast of a near-white and a
 * near-black extreme against the fill. Picking the better polarity (rather than the first
 * that merely clears the floor) is what gives accent-foreground real headroom — this is how the
 * ramp model absorbs #95: the label is an extreme step, so it clears with margin, not a
 * floor-hugging continuous solve. Both candidates are gamut-mapped so the math matches paint.
 */
function accentForegroundLabel(
  accent: OkLCH,
  hue: number,
  gamut: Gamut,
): OkLCH {
  const white = gamutMap({ L: 0.99, C: 0, H: hue }, gamut);
  const black = gamutMap({ L: 0.1, C: 0, H: hue }, gamut);
  return apcaLc(white, accent) >= apcaLc(black, accent) ? white : black;
}

/**
 * The accent-foreground LABEL (#153): the MOST CHROMATIC color at the accent hue that still clears the
 * accent-foreground target on the fill — gold on navy, mint on plum, cream on terracotta. The physics:
 * WCAG + APCA contrast are luminance-based, so a legible label always lands far from the fill
 * in LIGHTNESS; what the solve wins is the chroma the gamut allows AT that lightness (dark fills
 * → colorful light labels; light fills → deep colorful darks). It is a STRICT generalization of
 * `accentForegroundLabel`: that achromatic near-white/near-black extreme is the C→0 limit of the backoff
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
  // The achromatic fallback: the higher-contrast achromatic extreme — the guaranteed floor + the pole.
  const achromatic = accentForegroundLabel(accent, hue, gamut);
  // No chroma to spend (achromatic seed) → the label IS that extreme, bit-identical to the fallback.
  if (chroma <= CHROMA_BACKOFF_EPS) return achromatic;

  const target = withSolveMargin(CONTRAST_TARGETS.accentForeground);
  // The chromatic label sits on the same pole `accentForegroundLabel` picked (the far side of the fill
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
    // grey only as far as the target forces — the label keeps as much theme color as it can.
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
 * high-Lc text in either polarity, so we scan the accent hue across lightness for the
 * fill that (a) stays visible on the worst-case surface (≥3:1 + Lc 45, non-text)
 * and (b) lets a near-white OR near-black label clear the accent-foreground target — preferring
 * the MOST chromatic (most seed-faithful) such fill. The achromatic extremes gate FILL
 * feasibility (a fill that can host one is accepted); the shipped label is then the most
 * chromatic color that clears on that fill (`chromaticOnAccentLabel`, #153 — falling back to
 * the achromatic extreme). Deterministic, always returns a usable pair.
 */
export function solveAccent(
  seed: OkLCH,
  surfaceBg: OkLCH,
  gamut: Gamut,
): { accent: OkLCH; accentForeground: OkLCH } {
  const hue = seed.H;
  // Solve to a hair above the floors (#79) so the 4-dp-rounded baked fill + label still
  // clear their true floors — this scan bakes literals just like `solveForeground`.
  const target = withSolveMargin(CONTRAST_TARGETS.accentForeground);
  const ui = withSolveMargin(CONTRAST_TARGETS.ui);
  const labels = [
    gamutMap({ L: 0.99, C: 0, H: hue }, gamut), // near-white
    gamutMap({ L: 0.1, C: 0, H: hue }, gamut), // near-black
  ];

  let best: {
    accent: OkLCH;
    accentForeground: OkLCH;
    chroma: number;
    lc: number;
  } | null = null;
  let fallback: { accent: OkLCH; accentForeground: OkLCH; lc: number } | null =
    null;

  for (let L = 0.3; L <= 0.8 + 1e-9; L += 0.01) {
    const accent = gamutMap({ L, C: seed.C, H: hue }, gamut);
    // The fill must read as a UI element against the surface (non-text 3:1 / Lc 45).
    if (!checkContrast(accent, surfaceBg, ui).passes) continue;

    for (const label of labels) {
      const check = checkContrast(label, accent, target);
      const lc = check.apca;
      // Track the overall best label/fill in case nothing meets target (unreachable).
      if (!fallback || lc > fallback.lc)
        fallback = { accent, accentForeground: label, lc };

      if (check.passes) {
        // Prefer the most chromatic fill; tie-break on label contrast margin.
        if (
          !best ||
          accent.C > best.chroma + 1e-4 ||
          (Math.abs(accent.C - best.chroma) <= 1e-4 && lc > best.lc)
        ) {
          best = { accent, accentForeground: label, chroma: accent.C, lc };
        }
      }
    }
  }

  if (best)
    return {
      accent: best.accent,
      accentForeground: chromaticOnAccentLabel(best.accent, hue, seed.C, gamut),
    };
  // Should be unreachable, but never return undefined — defensive.
  if (fallback)
    return {
      accent: fallback.accent,
      accentForeground: chromaticOnAccentLabel(
        fallback.accent,
        hue,
        seed.C,
        gamut,
      ),
    };
  const accent = gamutMap(
    { L: surfaceBg.L >= 0.5 ? 0.45 : 0.7, C: seed.C, H: hue },
    gamut,
  );
  return {
    accent,
    accentForeground: chromaticOnAccentLabel(accent, hue, seed.C, gamut),
  };
}

/**
 * NATIVE-scheme accent — FAITHFUL to the seed's own lightness. Anchor the fill at
 * `seed.L` (the per-scheme dampened `seed.C`), verify it still reads as a UI element on
 * the worst-case surface, and host a legible accent-foreground label (the chromatic solve #153, which
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
): { accent: OkLCH; accentForeground: OkLCH } | null {
  const hue = seed.H;
  // Solve to a hair above the floors (#79) so the rounded baked fill + label still clear.
  const target = withSolveMargin(CONTRAST_TARGETS.accentForeground);
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
      // ship the higher-contrast extreme so accent-foreground has headroom (#95).
      const hosts = labels.some(
        (label) => checkContrast(label, accent, target).passes,
      );
      if (hosts)
        return {
          accent,
          accentForeground: chromaticOnAccentLabel(accent, hue, seed.C, gamut),
        };
    }
    // Once L pins to an extreme, further deltas can't move it — stop scanning.
    if (L <= 0 || L >= 1) break;
  }

  return null;
}

/**
 * Co-solve a STATUS fill (#160) — `error`/`warning`/`success`/`info` — exactly like the accent
 * accent, but at a FIXED canonical hue that does NOT depend on the theme seed. Delegates to
 * `solveAccent` with a synthetic seed carrying the status hue + the status ramp's nominal
 * chroma (the derived scan ignores the seed's lightness, so any L works): the fill is the most
 * chromatic lightness that stays visible on the worst-case surface (3:1 / Lc 45) AND hosts a
 * legible chromatic label (4.5 / Lc 60), per scheme. Pure, deterministic, never throws.
 */
export function solveStatusFill(
  hue: number,
  chroma: number,
  surfaceBg: OkLCH,
  gamut: Gamut,
): { fill: OkLCH; fillForeground: OkLCH } {
  const { accent, accentForeground } = solveAccent(
    { L: 0.5, C: chroma, H: hue },
    surfaceBg,
    gamut,
  );
  return { fill: accent, fillForeground: accentForeground };
}

/**
 * The `accent-hover` fill (#160): the accent, nudged a PERCEPTIBLE step in lightness so
 * it reads as a distinct interaction state, while still (a) reading as a UI element on the
 * worst-case surface (3:1 / Lc 45) and (b) hosting the SAME `accent-foreground` label at its floor
 * (4.5 / Lc 60) — the accent's co-solve constraint carries onto its hover. Nudge away from the
 * surface (darker on a light surface, lighter on a dark one): that direction only ever RAISES
 * both the fill's surface contrast and `accent-foreground`'s contrast on it (the label sits on the
 * far-from-surface pole), so the perceptible move never costs legibility. Scans outward from
 * `HOVER_DELTA_L`, rejecting candidates the lightness clamp left sub-perceptibly moved (an
 * extreme accent pins the preferred direction — pure black can't get darker); falls back to
 * the opposite direction, then to a minimal nudge on whichever side has clamp room, so it
 * always returns a fill perceptibly off the accent. Pure, deterministic, never throws.
 */
export function solveAccentHover(
  accent: OkLCH,
  accentForeground: OkLCH,
  seed: OkLCH,
  surfaceBg: OkLCH,
  gamut: Gamut,
): { fill: OkLCH } {
  const hue = seed.H;
  const ui = withSolveMargin(CONTRAST_TARGETS.ui);
  const label = withSolveMargin(CONTRAST_TARGETS.accentForeground);
  // A hover candidate is usable when it still reads as UI on the surface AND still hosts the
  // ACTUAL accent-foreground label (not merely some extreme) at its floor.
  const usable = (fill: OkLCH): boolean =>
    checkContrast(fill, surfaceBg, ui).passes &&
    checkContrast(accentForeground, fill, label).passes;
  const sign = surfaceBg.L >= 0.5 ? -1 : 1;

  const scan = (dir: number): OkLCH | null => {
    for (let delta = HOVER_DELTA_L; delta <= 0.5 + 1e-9; delta += 0.01) {
      const L = clamp01(accent.L + dir * delta);
      // An unclamped candidate realizes exactly `delta` (≥ HOVER_DELTA_L); anything less means
      // the clamp pinned L at an extreme and ATE the nudge — a sub-perceptible "hover" is not
      // a hover state, and a pinned L can't move any further in this direction. Stop, so the
      // caller falls through to the direction that still has room.
      if (Math.abs(L - accent.L) < HOVER_DELTA_L - 1e-9) break;
      const fill = gamutMap({ L, C: seed.C, H: hue }, gamut);
      if (usable(fill)) return fill;
      if (L <= 0 || L >= 1) break;
    }
    return null;
  };

  const fill = scan(sign) ?? scan(-sign);
  if (fill) return { fill };
  // Never throw: a minimal perceptible nudge — preferred direction when the clamp leaves it
  // room, else the opposite (accent.L is in [0,1], so at least one side always has ≥ delta).
  const preferred = accent.L + sign * HOVER_DELTA_L;
  const L =
    preferred >= 0 && preferred <= 1
      ? preferred
      : clamp01(accent.L - sign * HOVER_DELTA_L);
  return { fill: gamutMap({ L, C: seed.C, H: hue }, gamut) };
}

/**
 * Report a co-solved FILL (#151, generalized #160): the SHAPE of a fill's provenance is shared
 * across the accent, `accent-hover`, and every status fill; `role` carries the identity
 * and `seed` the seed-faithfulness story (`null` for the fixed-hue status fills, which have no
 * seed relationship). A pure function of the solved color + the solve path — reporting only.
 */
export function describeFill(
  role: RampRole,
  hue: number,
  seed: { native: boolean; deltaL: number } | null,
): FillProvenance {
  return { kind: "fill", role, hue, seed };
}

/**
 * Report a co-solved LABEL on a fill (#151/#153, generalized #160): which extreme the label
 * sits toward relative to the fill (`pole`, #95), the label's own hue/chroma, and whether its
 * chroma was backed off below the fill's NOMINAL chroma (the seed's for the accent, the
 * status ramp's for a status label — the achromatic extreme is the C→0 limit, so a chromatic
 * fill's achromatic label reports `true`). A pure function of the solved colors — reporting only.
 */
export function describeFillForeground(
  fillForeground: OkLCH,
  fill: OkLCH,
  role: RampRole,
  hue: number,
  nominalChroma: number,
): FillForegroundProvenance {
  return {
    kind: "fill-foreground",
    role,
    pole: fillForeground.L >= fill.L ? "white" : "black",
    hue,
    chroma: fillForeground.C,
    backedOff: fillForeground.C + CHROMA_BACKOFF_EPS < nominalChroma,
  };
}

/**
 * Report the accent FILL co-solve (#151) — the `describeFill` specialization for the
 * accent: whether the fill came from the FAITHFUL native solve (`native` — it then honors
 * `seed.L`, nudged at most minimally) vs the derived scan, and the signed `accent.L − seed.L`.
 */
export function describeAccent(
  accent: OkLCH,
  seed: OkLCH,
  native: boolean,
): FillProvenance {
  return describeFill("accent", seed.H, {
    native,
    deltaL: accent.L - seed.L,
  });
}

/**
 * Report the accent-foreground LABEL co-solve (#151/#153) — the `describeFillForeground` specialization for the
 * accent's label, measured against the seed's own chroma.
 */
export function describeAccentForeground(
  accentForeground: OkLCH,
  accent: OkLCH,
  seed: OkLCH,
): FillForegroundProvenance {
  return describeFillForeground(
    accentForeground,
    accent,
    "accent",
    seed.H,
    seed.C,
  );
}
