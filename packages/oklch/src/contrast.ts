/**
 * Contrast — APCA Lc (perceptual quality target) and WCAG 2.x ratio (compliance
 * floor), plus the binary-search solver that hits a target by moving L.
 *
 * OKLCH `L` is perceptual lightness, NOT contrast — a fixed ΔL passes for blue and
 * fails for yellow/cyan at the same step. So the engine never steps L by a fixed
 * offset; it solves L against the *relevant background*, on the gamut-mapped color.
 *
 * APCA constants: APCA-W3 0.1.9 / SA98G (https://github.com/Myndex/apca-w3,
 * https://github.com/Myndex/SAPC-APCA). WCAG ratio: WCAG 2.x 1.4.3 relative luminance.
 */

import { clamp01, oklchToSrgb, srgbToLinear } from "./convert";
import { gamutMap, inGamut } from "./gamut";
import type { Gamut, OkLCH } from "./types";

/** Clamp gamma sRGB channels into [0,1] for the contrast math (colors are pre-mapped). */
function clampSrgb({ r, g, b }: { r: number; g: number; b: number }): {
  r: number;
  g: number;
  b: number;
} {
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
}

/** WCAG relative luminance from gamma sRGB channels (0–1). */
function wcagLuminance({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/** WCAG 2.x contrast ratio (1–21) between two OKLCH colors. Symmetric. */
export function contrastWCAG(a: OkLCH, b: OkLCH): number {
  const la = wcagLuminance(clampSrgb(oklchToSrgb(a)));
  const lb = wcagLuminance(clampSrgb(oklchToSrgb(b)));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const SA98G = {
  mainTRC: 2.4,
  Rco: 0.2126729,
  Gco: 0.7151522,
  Bco: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
} as const;

/** APCA screen luminance Y from gamma sRGB (simple ^2.4 power, with black soft-clamp). */
function apcaY({ r, g, b }: { r: number; g: number; b: number }): number {
  const y =
    SA98G.Rco * r ** SA98G.mainTRC +
    SA98G.Gco * g ** SA98G.mainTRC +
    SA98G.Bco * b ** SA98G.mainTRC;
  return y > SA98G.blkThrs ? y : y + (SA98G.blkThrs - y) ** SA98G.blkClmp;
}

/**
 * APCA lightness contrast Lc (signed). Positive = dark text on light bg (BoW);
 * negative = light text on dark bg (WoB). Use `Math.abs` for magnitude.
 * `text` and `bg` are OKLCH; gamut is irrelevant to the math (uses gamma sRGB).
 */
export function contrastAPCA(text: OkLCH, bg: OkLCH): number {
  const Ytxt = apcaY(clampSrgb(oklchToSrgb(text)));
  const Ybg = apcaY(clampSrgb(oklchToSrgb(bg)));

  if (Math.abs(Ybg - Ytxt) < SA98G.deltaYmin) return 0;

  let sapc: number;
  let output: number;
  if (Ybg > Ytxt) {
    // BoW — normal polarity (dark text on light background).
    sapc = (Ybg ** SA98G.normBG - Ytxt ** SA98G.normTXT) * SA98G.scaleBoW;
    output = sapc < SA98G.loClip ? 0 : sapc - SA98G.loBoWoffset;
  } else {
    // WoB — reverse polarity (light text on dark background).
    sapc = (Ybg ** SA98G.revBG - Ytxt ** SA98G.revTXT) * SA98G.scaleWoB;
    output = sapc > -SA98G.loClip ? 0 : sapc + SA98G.loWoBoffset;
  }
  return output * 100;
}

/** Absolute APCA Lc — the magnitude consumers compare against the Lc targets. */
export function apcaLc(text: OkLCH, bg: OkLCH): number {
  return Math.abs(contrastAPCA(text, bg));
}

export interface ContrastTarget {
  /** WCAG 2.x ratio floor (compliance) — e.g. 4.5 body, 3 large/UI. */
  wcag: number;
  /** APCA Lc magnitude target (quality) — e.g. 75 body, 60 muted, 30 UI. */
  apca: number;
}

export interface SolveOptions {
  /** Background the foreground must contrast against (already gamut-mapped). */
  bg: OkLCH;
  /** Hue to hold while moving L (the brand hue, usually). */
  hue: number;
  /** Preferred chroma; backed off toward 0 if the target is otherwise infeasible. */
  chroma: number;
  target: ContrastTarget;
  gamut: Gamut;
}

/** Does this color clear BOTH the WCAG floor and the APCA target against `bg`? */
function meets(fg: OkLCH, bg: OkLCH, target: ContrastTarget): boolean {
  return contrastWCAG(fg, bg) >= target.wcag && apcaLc(fg, bg) >= target.apca;
}

/**
 * Solve a foreground OKLCH that meets the contrast target against `bg`, holding the
 * given hue and preferring the given chroma. Moves L *away* from the background
 * (darker on a light bg, lighter on a dark bg), binary-searching the minimal change
 * that clears the target. Backs chroma off toward grey if no chroma at the chosen
 * extreme is feasible, so black/white is always reachable — the solver therefore
 * always returns a color that meets the target (it cannot fail for a reachable target).
 *
 * Pure, deterministic, never throws.
 */
export function solveForeground(opts: SolveOptions): OkLCH {
  const { bg, hue, target, gamut } = opts;
  // Direction: light backgrounds want darker text, dark backgrounds want lighter text.
  const goDarker = bg.L >= 0.5;

  // Try the requested chroma first, then progressively desaturate. At chroma 0 the
  // foreground can reach pure black/white, which clears any reachable target.
  const chromaSteps = chromaBackoff(opts.chroma);

  for (const C of chromaSteps) {
    const solved = solveAtChroma(bg, hue, C, target, gamut, goDarker);
    if (solved && meets(solved, bg, target)) return solved;
  }

  // Fallback: pure black or white in the target gamut (guaranteed to meet a sane target).
  return gamutMap({ L: goDarker ? 0 : 1, C: 0, H: hue }, gamut);
}

/** Descending chroma candidates from `start` down to 0. */
function chromaBackoff(start: number): number[] {
  const steps: number[] = [];
  for (let C = Math.max(0, start); C > 0.001; C -= 0.02) steps.push(C);
  steps.push(0);
  return steps;
}

/**
 * At a fixed chroma, binary-search L in the chosen direction for the least-extreme
 * value that meets the target. Returns null if even the extreme L fails at this chroma.
 */
function solveAtChroma(
  bg: OkLCH,
  hue: number,
  chroma: number,
  target: ContrastTarget,
  gamut: Gamut,
  goDarker: boolean,
): OkLCH | null {
  const at = (L: number): OkLCH =>
    gamutMap({ L: clamp01(L), C: chroma, H: hue }, gamut);

  const extreme = at(goDarker ? 0 : 1);
  if (!meets(extreme, bg, target)) return null;

  // Search between the background's L (low contrast end) and the extreme (high contrast).
  let lo = goDarker ? 0 : bg.L; // darker → [0, bg.L]; lighter → [bg.L, 1]
  let hi = goDarker ? bg.L : 1;

  // 24 iterations resolves L to < 1e-7 — far finer than the 4-dp baked literal.
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (meets(at(mid), bg, target)) {
      // mid is contrasty enough; move toward bg to find the least-extreme L.
      if (goDarker) lo = mid;
      else hi = mid;
    } else if (goDarker) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const candidate = at(goDarker ? lo : hi);
  return meets(candidate, bg, target) ? candidate : extreme;
}

/** True when a color sits inside the gamut (re-exported for the harness/tests). */
export { inGamut };
