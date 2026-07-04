/**
 * The batteries-included harmony TIER (#152) — the receipt-grade upgrade to the decorative
 * harmony palette (`harmony.ts`, #102).
 *
 * Where `buildHarmonyPalette` emits single decorative colors (seed L/C held, hue rotated,
 * gamut-mapped) and hands the contrast homework to the consumer, this tier gives each
 * derived harmony hue the SAME treatment the brand hue gets, composed from the existing
 * machinery: a full `50…950` ramp per scheme (`buildRamp`, #101 — same generative rules,
 * same per-scheme seed-chroma dampening, same per-step gamut map + `oog` flags, anchored to
 * the seed's own lightness exactly like the brand ramp, #108), plus two receipt-backed
 * picks per hue — a text-grade pick (`accentText`: 4.5:1 + Lc 60) and a UI-grade fill pick
 * (`ui`: 3:1 + Lc 45) — each landed by `minPass` against the scheme's worst-case surface and
 * carrying solve-time step provenance, exactly like the semantic `auto` tokens.
 *
 * DECORATIVE, still outside the frozen 14-token semantic contract: this is a separated
 * annex the studio opts into (the `includeHarmony` export surface in `export.ts`), never a
 * growth of the semantic token list. Status hues stay fixed-hue and are NOT part of this
 * tier (`error` stays red — #66). Built by reusing `resolveTheme` so the seed, the
 * dark-scheme dampening, the anchor, and the worst-case surface each pick is solved against
 * are IDENTICAL to what the brand ramp ships — one source of truth, no re-derived drift.
 *
 * Pure, deterministic, isomorphic, never throws — bad input yields the fallback seed's tier.
 */

import { buildRamp } from "./ramp";
import { minPass } from "./binding";
import { resolveTheme } from "./palette";
import { CONTRAST_TARGETS } from "./targets";
import type { HarmonyKind } from "./harmony";
import type { EngineOptions } from "./palette";
import type {
  Gamut,
  OkLCH,
  Ramp,
  RampLabel,
  RampPair,
  Scheme,
  SchemePair,
} from "./types";

/**
 * One of the 7 derived harmony hues — the design's dedupe/naming of the four relationships'
 * offsets (analogous ±30°, complementary 180°, triadic ±120°, split-complementary 150°/210°)
 * into stable, self-documenting, kebab-case keys. `-a`/`-b` disambiguate the two hues of a
 * two-sided relationship, ordered by their signed offset — the smaller (more
 * counter-clockwise) offset is `-a`: analogous −30/+30, triadic −120/+120, split 150/210.
 * These names are the public group labels the export tier emits (`--harmony-<hue>-…`).
 */
export type HarmonyHue =
  | "analogous-a"
  | "analogous-b"
  | "complementary"
  | "triadic-a"
  | "triadic-b"
  | "split-complementary-a"
  | "split-complementary-b";

/** Each derived hue's parent relationship and its signed hue offset from the seed, in
 *  degrees. The single source for both the rotation math and the relationship metadata. */
const HARMONY_HUE_ANGLES = {
  "analogous-a": { relationship: "analogous", offset: -30 },
  "analogous-b": { relationship: "analogous", offset: 30 },
  complementary: { relationship: "complementary", offset: 180 },
  "triadic-a": { relationship: "triadic", offset: -120 },
  "triadic-b": { relationship: "triadic", offset: 120 },
  "split-complementary-a": { relationship: "split-complementary", offset: 150 },
  "split-complementary-b": { relationship: "split-complementary", offset: 210 },
} as const satisfies Record<
  HarmonyHue,
  { relationship: HarmonyKind; offset: number }
>;

/** The canonical harmony-hue order, exported for the studio's display (mirrors
 *  `HARMONY_KINDS`). Insertion order of `HARMONY_HUE_ANGLES` = relationship order. */
export const HARMONY_HUES = Object.keys(HARMONY_HUE_ANGLES) as HarmonyHue[];

/**
 * Provenance for a harmony pick — the SETTLED step-provenance shape (`kind`/`role`/`label`,
 * mirroring `StepProvenance`), over a `HarmonyHue` role rather than a `RampRole`. The
 * decorative tier carries its own provenance type so the core `BindingProvenance` union that
 * the semantic receipt reads (#151/#153) stays pristine — the same separation the annex has
 * from the frozen token contract. Reported by `minPass` AT SOLVE TIME, never value-matched.
 */
export interface HarmonyStepProvenance {
  kind: "step";
  /** Which derived hue's ramp the pick was landed on. */
  role: HarmonyHue;
  /** The ramp step the pick bound to. */
  label: RampLabel;
}

/** One receipt-backed harmony pick: the baked color and the step it bound to. */
export interface HarmonyPick {
  color: OkLCH;
  provenance: HarmonyStepProvenance;
}

/** One derived hue resolved for a SINGLE scheme: its ramp and the two graded picks. */
export interface HarmonyHueResult {
  hue: HarmonyHue;
  relationship: HarmonyKind;
  /** Signed hue offset from the seed, in degrees. */
  offset: number;
  /** The `50…950` ramp at this hue for this scheme — rules- and gamut-treated like brand. */
  ramp: Ramp;
  /** Text-grade pick (`accentText`: 4.5:1 + Lc 60 vs the worst-case surface). */
  text: HarmonyPick;
  /** UI-grade fill pick (`ui`: 3:1 + Lc 45 vs the worst-case surface). */
  fill: HarmonyPick;
}

/** The harmony tier resolved for one scheme — the per-scheme counterpart of `SchemeResult`. */
export interface HarmonySchemeResult {
  hues: Record<HarmonyHue, HarmonyHueResult>;
  /** The per-scheme, chroma-dampened, gamut-mapped brand seed the hues rotate around. */
  seed: OkLCH;
  gamut: Gamut;
  /** True when the brand input failed to parse and the fallback seed was used. */
  isFallback: boolean;
}

/** One harmony pick zipped for both schemes (`light-dark()`). */
export interface HarmonyPickPair {
  light: HarmonyPick;
  dark: HarmonyPick;
}

/** One derived hue resolved for BOTH schemes — ramp + picks zipped per step/pick. */
export interface HarmonyHueTier {
  hue: HarmonyHue;
  relationship: HarmonyKind;
  offset: number;
  ramp: RampPair;
  text: HarmonyPickPair;
  fill: HarmonyPickPair;
}

/** The dual-scheme harmony tier — the `buildHarmonyTier` output the export serializers read
 *  (the decorative counterpart of `TokenSet`). */
export interface HarmonyTier {
  hues: Record<HarmonyHue, HarmonyHueTier>;
  meta: {
    /** The per-scheme brand seed the hues rotate around. */
    seed: SchemePair;
    gamut: Gamut;
    isFallback: boolean;
  };
}

/** Rotate a hue by `delta` degrees, normalized into [0, 360). */
function rotate(hue: number, delta: number): number {
  return (((hue + delta) % 360) + 360) % 360;
}

/**
 * Land one graded pick on a hue's ramp: `minPass` returns the least-extreme step that clears
 * `target` against the worst-case surface (the discrete counterpart of `solveForeground`,
 * with the extreme-step fallback so it always resolves), and we tag the winning step with the
 * hue as its provenance role — the truthful, solve-time source the receipt reads.
 */
function landPick(
  hue: HarmonyHue,
  ramp: Ramp,
  surface2: OkLCH,
  target: (typeof CONTRAST_TARGETS)[keyof typeof CONTRAST_TARGETS],
): HarmonyPick {
  const step = minPass(ramp, surface2, target);
  return {
    color: step.color,
    provenance: { kind: "step", role: hue, label: step.label },
  };
}

/**
 * Resolve the harmony tier for ONE scheme. Reuses `resolveTheme` so the seed (per-scheme
 * chroma-dampened + gamut-mapped), the anchor (the brand ramp's seed-anchored step, #108),
 * and the worst-case surface each pick is solved against are IDENTICAL to the brand ramp's —
 * no re-derived surface that could silently drift from what ships. Each derived hue then gets
 * a ramp built with the same generative rules, chroma, gamut, and anchor as brand, with only
 * the hue rotated; its text/fill picks land via `minPass` against that surface. Never throws.
 */
export function resolveHarmonyTier(
  brandColor: unknown,
  scheme: Scheme,
  opts: EngineOptions = {},
): HarmonySchemeResult {
  const base = resolveTheme(brandColor, scheme, opts);
  const { seed, gamut, isFallback } = base;
  // The worst-case surface (`surface-2`) the semantic `auto` tokens solved against — read
  // straight off the resolved token so it can never diverge from the shipped surface.
  const surface2 = base.tokens["surface-2"];
  // Anchor every harmony ramp to the seed's own lightness at the brand ramp's anchor step
  // (#108), so the derived hue's identity color lands ON its ramp exactly as brand's does.
  const anchor = { label: base.anchorLabel, L: seed.L };
  const rules = opts?.rules;

  const hues = {} as Record<HarmonyHue, HarmonyHueResult>;
  for (const hue of HARMONY_HUES) {
    const { relationship, offset } = HARMONY_HUE_ANGLES[hue];
    const ramp = buildRamp({
      hue: rotate(seed.H, offset),
      chroma: seed.C,
      gamut,
      anchor,
      rules,
    });
    hues[hue] = {
      hue,
      relationship,
      offset,
      ramp,
      text: landPick(hue, ramp, surface2, CONTRAST_TARGETS.accentText),
      fill: landPick(hue, ramp, surface2, CONTRAST_TARGETS.ui),
    };
  }

  return { hues, seed, gamut, isFallback };
}

/**
 * Build the dual-scheme harmony tier: resolve both schemes and zip each hue's ramp — and each
 * graded pick — into a `{ light, dark }` pair for `light-dark()` output. The decorative
 * counterpart of `buildTokenSet`, and what the `export.ts` harmony serializers consume. Pure,
 * deterministic, never throws.
 */
export function buildHarmonyTier(
  brandColor: unknown,
  opts: EngineOptions = {},
): HarmonyTier {
  const light = resolveHarmonyTier(brandColor, "light", opts);
  const dark = resolveHarmonyTier(brandColor, "dark", opts);

  const hues = {} as Record<HarmonyHue, HarmonyHueTier>;
  for (const hue of HARMONY_HUES) {
    const l = light.hues[hue];
    const d = dark.hues[hue];
    hues[hue] = {
      hue,
      relationship: l.relationship,
      offset: l.offset,
      ramp: { light: l.ramp, dark: d.ramp },
      text: { light: l.text, dark: d.text },
      fill: { light: l.fill, dark: d.fill },
    };
  }

  return {
    hues,
    meta: {
      seed: { light: light.seed, dark: dark.seed },
      gamut: light.gamut,
      isFallback: light.isFallback,
    },
  };
}
