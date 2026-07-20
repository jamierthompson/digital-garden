/**
 * The batteries-included harmony TIER (#152) — the receipt-grade upgrade to the decorative
 * harmony palette (`harmony.ts`, #102), assembled per derived hue with its relationship
 * metadata for the `harmonyTierTo*` export serializers (`export.ts`) and the studio.
 *
 * Where `buildHarmonyPalette` emits single decorative colors (seed L/C held, hue rotated,
 * gamut-mapped) and hands the contrast homework to the consumer, this tier gives each
 * derived harmony hue the SAME treatment the accent hue gets: a full `50…950` ramp per
 * scheme (built on that scheme's own INDEPENDENT lightness scale, #160, same generative
 * rules, same per-scheme seed-chroma dampening, same per-step gamut map + `oog` flags,
 * anchored to the seed's own lightness exactly like the accent ramp, #108), plus two
 * receipt-backed picks per hue — a text-grade pick (`accentText`: 4.5:1 + Lc 60) and a
 * UI-grade fill pick (`ui`: 3:1 + Lc 45), each landed by `minPass` against the scheme's
 * worst-case surface and carrying solve-time step provenance.
 *
 * Since #334 the harmony colors are part of the GUARDED SEMANTIC SURFACE: `resolveTheme`
 * builds every `harmony-<hue>` ramp and binds the `harmony-<hue>` (decorative anchor) /
 * `-fill` / `-text` tokens. This module therefore SOLVES NOTHING — it reads the resolved
 * ramps, tokens, and bindings straight off `resolveTheme` and reshapes them per hue with
 * the relationship metadata. One solve, one source of truth, no re-derived drift. Status
 * hues stay fixed-hue and are NOT part of this tier (`error` stays red — #66).
 *
 * Pure, deterministic, isomorphic, never throws — bad input yields the fallback seed's tier.
 */

import { resolveTheme } from "./palette";
import {
  HARMONY_HUES,
  HARMONY_HUE_ANGLES,
  type HarmonyHue,
  type HarmonyKind,
} from "./harmony";
import type { EngineOptions } from "./palette";
import type {
  Gamut,
  OkLCH,
  Ramp,
  RampLabel,
  RampPair,
  Scheme,
  SchemePair,
  SchemeResult,
} from "./types";

// The hue vocabulary lives in `harmony.ts` (with the relationship angles it derives from);
// re-exported here for the tier's consumers.
export { HARMONY_HUES, type HarmonyHue };

/**
 * Provenance for a harmony pick — the step-provenance shape (`kind`/`role`/`label`,
 * mirroring `StepProvenance`) over a `HarmonyHue` role rather than a `RampRole`: the tier
 * names the derived hue itself (`"analogous-a"`), while the semantic surface's binding
 * provenance names the ramp role (`"harmony-analogous-a"`) — same solve, two vocabularies.
 * Reported by the binding layer AT SOLVE TIME, never value-matched.
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
  /** The `50…950` ramp at this hue for this scheme — rules- and gamut-treated like the accent ramp. */
  ramp: Ramp;
  /** Text-grade pick (`accentText`: 4.5:1 + Lc 60 vs the worst-case surface). */
  text: HarmonyPick;
  /** UI-grade fill pick (`ui`: 3:1 + Lc 45 vs the worst-case surface). */
  fill: HarmonyPick;
}

/** The harmony tier resolved for one scheme — the per-scheme counterpart of `SchemeResult`. */
export interface HarmonySchemeResult {
  hues: Record<HarmonyHue, HarmonyHueResult>;
  /** The per-scheme, chroma-dampened, gamut-mapped theme seed the hues rotate around. */
  seed: OkLCH;
  gamut: Gamut;
  /** True when the theme input failed to parse and the fallback seed was used. */
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
    /** The per-scheme theme seed the hues rotate around. */
    seed: SchemePair;
    gamut: Gamut;
    isFallback: boolean;
  };
}

/**
 * Read one graded pick off the resolved scheme: the token's baked color plus the step its
 * binding landed, re-voiced with the derived hue as the provenance role. The binding of a
 * `harmony-<hue>-<grade>` token is a `minPass` step by schema; the anchor-label fallback
 * only exists to keep this total (never-throwing) should the schema ever retype it.
 */
function pickOf(
  base: SchemeResult,
  hue: HarmonyHue,
  grade: "text" | "fill",
): HarmonyPick {
  const name = `harmony-${hue}-${grade}` as const;
  const provenance = base.bindings[name];
  const label =
    provenance?.kind === "step" ? provenance.label : base.anchorLabel;
  return {
    color: base.tokens[name],
    provenance: { kind: "step", role: hue, label },
  };
}

/**
 * Resolve the harmony tier for ONE scheme — a per-hue reshaping of `resolveTheme`'s output
 * (which builds the harmony ramps and binds the harmony tokens since #334), so the seed,
 * anchor, worst-case surface, and every color are IDENTICAL to what the semantic surface
 * ships. Never throws.
 */
export function resolveHarmonyTier(
  themeColor: unknown,
  scheme: Scheme,
  opts: EngineOptions = {},
): HarmonySchemeResult {
  const base = resolveTheme(themeColor, scheme, opts);
  const { seed, gamut, isFallback } = base;

  const hues = {} as Record<HarmonyHue, HarmonyHueResult>;
  for (const hue of HARMONY_HUES) {
    const { relationship, offset } = HARMONY_HUE_ANGLES[hue];
    hues[hue] = {
      hue,
      relationship,
      offset,
      ramp: base.ramps[`harmony-${hue}`],
      text: pickOf(base, hue, "text"),
      fill: pickOf(base, hue, "fill"),
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
  themeColor: unknown,
  opts: EngineOptions = {},
): HarmonyTier {
  const light = resolveHarmonyTier(themeColor, "light", opts);
  const dark = resolveHarmonyTier(themeColor, "dark", opts);

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
