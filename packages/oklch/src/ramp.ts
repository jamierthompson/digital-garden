/**
 * Low-level surface: build a perceptual lightness ramp for a hue.
 *
 * Part of the engine's exported low-level API (alongside the conversions, gamut map,
 * and contrast functions) so the interactive studio (#70) and any caller that wants
 * raw stops — rather than the high-level solved token set — can step lightness and
 * read measured contrast directly. Every stop is gamut-mapped. Pure, never throws.
 */

import { gamutMap, inGamut } from "./gamut";
import {
  RAMP_LABELS,
  type ChromaPolicy,
  type Gamut,
  type HuePolicy,
  type LightnessDistribution,
  type OkLCH,
  type Ramp,
  type RampLabel,
  type RampRules,
} from "./types";

/**
 * The lightness of each `50…950` step. NOT an even split: it is denser near the two
 * extremes (Tailwind-shaped) so the light end yields three close-spaced page/elevated
 * surfaces and the dark end yields three more for dark mode, while the mid-range spreads
 * out for accents and text. A single perceptual-lightness scale, shared by every role
 * ramp; only the chroma (and hue) differ per role/scheme. Monotonic, lightest → darkest.
 */
const RAMP_L: Record<RampLabel, number> = {
  "50": 0.985,
  "100": 0.967,
  "200": 0.922,
  "300": 0.87,
  "400": 0.708,
  "500": 0.556,
  "600": 0.439,
  "700": 0.371,
  "800": 0.269,
  "900": 0.205,
  "950": 0.145,
};

/** `t` for step index `i` — 0 at the lightest step, 1 at the darkest. */
function tOf(i: number): number {
  return i / (RAMP_LABELS.length - 1);
}

/**
 * The lightness scale per distribution (#101): the 11 step lightnesses, lightest →
 * darkest. `tailwind` is the hand-shaped `RAMP_L` table (the default — reproduces the
 * un-ruled engine exactly). The named curves reshape ONLY the five interior steps
 * (`300…700`) between the pinned shoulders (`50/100/200` and `800/900/950` keep their
 * `RAMP_L` values): the shoulders host the surfaces and the extreme-fallback steps, so
 * pinning them is what makes the engine's contrast guarantees hold under EVERY policy —
 * the acceptance criterion the prototype's full-span curves could not meet (a full-span
 * `linear`/`soft` darkens `surface-2` past what any neutral step can host Lc-75 text
 * on). The curves are the prototype's easings, remapped over the interior span.
 */
function scaleOf(distribution: LightnessDistribution): number[] {
  const base = RAMP_LABELS.map((label) => RAMP_L[label]);
  if (distribution === "tailwind") return base;
  // Interior easing e(t): t = 0 at the 200 shoulder, 1 at the 800 shoulder.
  const ease = (t: number): number => {
    switch (distribution) {
      case "linear":
        return t;
      case "eased":
        return t * t * (3 - 2 * t); // smoothstep
      case "punchy":
        return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease-in-out quad
      case "soft":
        return 0.5 + (t - 0.5) * 0.6; // interior huddles toward the mid — low-contrast band
    }
  };
  const light = RAMP_L["200"];
  const dark = RAMP_L["800"];
  // Steps 300…700 sit at indexes 3…7; t spans the open interior of [200 … 800].
  return base.map((L, i) =>
    i >= 3 && i <= 7 ? light - ease((i - 2) / 6) * (light - dark) : L,
  );
}

/** Per-step nominal-chroma multiplier for a chroma policy (#101). `flat` holds the
 *  nominal at 1 (the default — the gamut map alone shapes the extremes); `taper` is the
 *  prototype's sine bell (chroma pulled from both extremes); `hold` its flatter power
 *  (chroma kept into the darks). */
function chromaCurve(t: number, policy: ChromaPolicy): number {
  if (policy === "flat") return 1;
  const exponent = policy === "hold" ? 0.42 : 0.72;
  return Math.sin(Math.PI * t) ** exponent;
}

/** Per-step hue drift in degrees for a hue policy (#101) — the prototype's ±9° ramps. */
function hueDelta(t: number, policy: HuePolicy): number {
  if (policy === "warm-shadows") return (t - 0.5) * 2 * 9;
  if (policy === "cool-highlights") return -(t - 0.5) * 2 * 9;
  return 0;
}

export interface RampSpec {
  /** Hue held across the ramp (the brand hue for `brand`/`neutral`, a canonical status hue). */
  hue: number;
  /** Nominal chroma held across the ramp; gamut-mapped per step, so extremes desaturate. */
  chroma: number;
  gamut: Gamut;
  /**
   * Seed anchor (#108): pin `label`'s step to lightness `L` EXACTLY and bend the rest of
   * the scale around it — a per-side shift+scale that keeps both endpoints, so the seed's
   * own color lands ON the ramp instead of drifting between steps. The engine anchors
   * only the `brand` ramp (see `palette.ts`); neutral/status ramps stay on the shared
   * scale. `L` is clamped into the scale's open interval so the ramp stays monotonic.
   */
  anchor?: { label: RampLabel; L: number };
  /** Generative ramp-tier rules (#101). Omitted/partial → the documented defaults
   *  (`tailwind` scale, `flat` chroma, `constant` hue), which reproduce the un-ruled
   *  output exactly. */
  rules?: RampRules;
}

/**
 * The anchored lightness of one step: linear per-side rescale of the chosen scale so the
 * anchor index hits `anchorL` exactly while both ends keep their lightness (endpoints
 * preserved → surfaces bound to the extremes are unaffected). Each side is a
 * positive-slope linear map, so step order (lightest → darkest) is preserved as long as
 * the anchor L sits inside the scale — enforced by the clamp.
 */
function anchoredL(
  i: number,
  scale: number[],
  anchorIdx: number,
  anchorL: number,
): number {
  const L = scale[i];
  const La = scale[anchorIdx];
  const lightEnd = scale[0];
  const darkEnd = scale[scale.length - 1];
  // Keep the anchor strictly inside the scale so both side-spans stay positive.
  const EDGE = 0.005;
  const target = Math.min(lightEnd - EDGE, Math.max(darkEnd + EDGE, anchorL));
  if (L >= La) {
    // Light side (incl. the anchor itself): rescale [La, lightEnd] → [target, lightEnd].
    const span = lightEnd - La || 1e-6;
    return target + (L - La) * ((lightEnd - target) / span);
  }
  // Dark side: rescale [darkEnd, La] → [darkEnd, target].
  const span = La - darkEnd || 1e-6;
  return target + (L - La) * ((target - darkEnd) / span);
}

/**
 * Build a role's `50…950` ramp — a pure perceptual-lightness primitive at a fixed hue and
 * nominal chroma. Each step is gamut-mapped (so a dark high-chroma step desaturates toward
 * the boundary, exactly as the screen paints it), and carries an `oog` flag that is true
 * when the nominal chroma exceeded the gamut at that lightness and had to be reduced.
 * Deterministic, never throws. This is the primitive the semantic tokens bind to.
 */
export function buildRamp(spec: RampSpec): Ramp {
  const distribution = spec.rules?.distribution ?? "tailwind";
  const chromaPolicy = spec.rules?.chromaPolicy ?? "flat";
  const huePolicy = spec.rules?.huePolicy ?? "constant";
  const scale = scaleOf(distribution);
  // A non-finite anchor L would propagate NaN into every step (QA-108); the never-throws,
  // never-garbage posture treats it as "no anchor". Unreachable via resolveTheme (a parsed
  // seed L is always finite) — this defends the public low-level API.
  const anchor =
    spec.anchor && Number.isFinite(spec.anchor.L) ? spec.anchor : undefined;
  const anchorIdx = anchor ? RAMP_LABELS.indexOf(anchor.label) : -1;
  return RAMP_LABELS.map((label, i) => {
    const t = tOf(i);
    const delta = hueDelta(t, huePolicy);
    const nominal: OkLCH = {
      L: anchor ? anchoredL(i, scale, anchorIdx, anchor.L) : scale[i],
      C: Math.max(0, spec.chroma) * chromaCurve(t, chromaPolicy),
      // Untouched when the policy doesn't drift (bit-identical default output);
      // normalized into [0, 360) only when a real delta is applied.
      H: delta === 0 ? spec.hue : (((spec.hue + delta) % 360) + 360) % 360,
    };
    return {
      label,
      color: gamutMap(nominal, spec.gamut),
      oog: !inGamut(nominal, spec.gamut),
    };
  });
}

export interface RampOptions {
  /** Number of stops (inclusive of the endpoints). Clamped to ≥ 2. */
  steps?: number;
  /** Chroma to hold across the ramp (gamut-mapped per stop). */
  chroma?: number;
  /** Lowest lightness (0–1). */
  minL?: number;
  /** Highest lightness (0–1). */
  maxL?: number;
  gamut?: Gamut;
}

/**
 * Even lightness ramp across [minL, maxL] at a fixed hue, each stop gamut-mapped to the
 * target gamut so chroma never exceeds what the screen shows. Deterministic.
 */
export function buildLightnessRamp(
  hue: number,
  opts: RampOptions = {},
): OkLCH[] {
  const steps = Math.max(2, Math.floor(opts.steps ?? 11));
  const chroma = Math.max(0, opts.chroma ?? 0.12);
  const minL = opts.minL ?? 0.05;
  const maxL = opts.maxL ?? 0.98;
  const gamut: Gamut = opts.gamut ?? "srgb";

  const ramp: OkLCH[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const L = minL + (maxL - minL) * t;
    ramp.push(gamutMap({ L, C: chroma, H: hue }, gamut));
  }
  return ramp;
}
