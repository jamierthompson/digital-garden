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
  type Scheme,
} from "./types";

/**
 * The lightness of each `50…950` step — a SEPARATE, independently-tuned scale per scheme
 * (#160). The engine does NOT mirror one scale into the other (a mirror-label flip gives
 * muddy dark neutrals — architecture.md: "Dark re-generates each ramp and re-solves every
 * binding against dark's OWN surfaces"). Each scale reserves its FIVE-surface band at its own
 * end — light: `50…400` at the light end (bg · surface · surface-elevated · surface-hover ·
 * surface-selected, ~0.028 apart); dark: `600…950` at the dark end (mirror ROLES, not values)
 * — then spreads the remaining steps into that scheme's text zone so `text`/`muted-foreground`/
 * `border` land on THREE distinct steps. Monotonic, lightest → darkest.
 */
const RAMP_L: Record<Scheme, Record<RampLabel, number>> = {
  // LIGHT: five tight surfaces at the top (50…400); a spread text zone below (500…950) so
  // border/muted/text separate against the worst-case light surface (`surface-selected`, 400).
  light: {
    "50": 0.985,
    "100": 0.958,
    "200": 0.93,
    "300": 0.902,
    "400": 0.874,
    "500": 0.62,
    "600": 0.49,
    "700": 0.38,
    "800": 0.29,
    "900": 0.215,
    "950": 0.145,
  },
  // DARK: five tight surfaces at the bottom (600…950); a spread text zone above (50…500) so
  // border/muted/text separate against the worst-case dark surface (`surface-selected`, 600).
  // Tuned independently for clean (not muddy) dark neutrals — not a flip of the light scale.
  dark: {
    "50": 0.985,
    "100": 0.93,
    "200": 0.85,
    "300": 0.76,
    "400": 0.67,
    "500": 0.56,
    "600": 0.34,
    "700": 0.3,
    "800": 0.26,
    "900": 0.21,
    "950": 0.165,
  },
};

/** `t` for step index `i` — 0 at the lightest step, 1 at the darkest. */
function tOf(i: number): number {
  return i / (RAMP_LABELS.length - 1);
}

/**
 * The lightness scale per distribution (#101), for one scheme. `tailwind` is the hand-shaped
 * per-scheme `RAMP_L` table (the default — reproduces the un-ruled engine exactly). The named
 * curves reshape ONLY that scheme's TEXT-ZONE interior — the contiguous run of non-surface
 * steps between the innermost surface and the far text extreme (`INTERIOR_RANGE`) — while the
 * five surface steps AND the extreme text step stay PINNED at their `RAMP_L` values. Pinning
 * the surfaces is what makes the contrast guarantees hold under EVERY policy: a floated surface
 * that a distribution darkens into a mid-tone can host NO body text at Lc 75 (the exact bug the
 * prototype's full-span curves hit). Because the scales are per-scheme, the reshapeable interior
 * differs by scheme — light's text zone is BELOW its surfaces (`500…900`), dark's is ABOVE
 * (`100…500`). The curves are the prototype's easings, remapped over that span.
 */
const INTERIOR_EASE: Partial<
  Record<LightnessDistribution, (t: number) => number>
> = {
  linear: (t) => t,
  eased: (t) => t * t * (3 - 2 * t), // smoothstep
  punchy: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2), // ease-in-out quad
  soft: (t) => 0.5 + (t - 0.5) * 0.6, // interior huddles toward the mid — low-contrast band
};

/**
 * The reshapeable text-zone interior per scheme: `[lo, hi]` step indexes. Everything outside
 * is pinned (the five surfaces + the far text extreme). Light: surfaces `50…400` (indexes 0–4)
 * and the extreme `950` (10) pin; reshape `500…900` (5–9). Dark: surfaces `600…950` (6–10) and
 * the extreme `50` (0) pin; reshape `100…500` (1–5).
 */
const INTERIOR_RANGE: Record<Scheme, { lo: number; hi: number }> = {
  light: { lo: 5, hi: 9 },
  dark: { lo: 1, hi: 5 },
};

function scaleOf(
  distribution: LightnessDistribution,
  scheme: Scheme,
): number[] {
  const base = RAMP_LABELS.map((label) => RAMP_L[scheme][label]);
  // `tailwind` — and, defensively, any out-of-union string reaching here from JS — uses
  // the default scale rather than producing NaN interior lightness: the same posture as
  // the anchor's non-finite guard (QA-101).
  const ease = INTERIOR_EASE[distribution];
  if (!ease) return base;
  const { lo, hi } = INTERIOR_RANGE[scheme];
  // The pinned steps bounding the interior: the surface just lighter than it, and the text
  // extreme just darker. `t` spans that open interior; `ease(0)→light`, `ease(1)→dark`.
  const lightIdx = lo - 1;
  const darkIdx = hi + 1;
  const light = base[lightIdx];
  const dark = base[darkIdx];
  const span = darkIdx - lightIdx;
  return base.map((L, i) =>
    i >= lo && i <= hi
      ? light - ease((i - lightIdx) / span) * (light - dark)
      : L,
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
  /** Hue held across the ramp (the accent hue for `accent`/`neutral`, a canonical status hue). */
  hue: number;
  /** Nominal chroma held across the ramp; gamut-mapped per step, so extremes desaturate. */
  chroma: number;
  gamut: Gamut;
  /** Which scheme's independent lightness scale to build on (#160). Defaults to `light` — the
   *  engine's `resolveTheme` always passes it explicitly; the public low-level API stays
   *  back-compatible for callers that only want the light ramp. */
  scheme?: Scheme;
  /**
   * Seed anchor (#108): pin `label`'s step to lightness `L` EXACTLY and bend the rest of
   * the scale around it — a per-side shift+scale that keeps both endpoints, so the seed's
   * own color lands ON the ramp instead of drifting between steps. The engine anchors
   * only the `accent` ramp (see `palette.ts`); neutral/status ramps stay on the scheme's
   * own scale. `L` is clamped into the scale's open interval so the ramp stays monotonic.
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
  const scale = scaleOf(distribution, spec.scheme ?? "light");
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
  // A non-finite `steps` count would loop forever (Infinity) or emit an empty ramp (NaN);
  // the never-hangs posture degrades it to the documented default, like the other guards.
  const rawSteps = opts.steps ?? 11;
  const steps = Math.max(
    2,
    Math.floor(Number.isFinite(rawSteps) ? rawSteps : 11),
  );
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
