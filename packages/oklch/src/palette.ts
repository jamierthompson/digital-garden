/**
 * The high-level engine: `brandColor` → per-role `50…950` ramps + the contrast-solved,
 * gamut-mapped semantic token set the ramps bind to.
 *
 * Two wrappers over the low-level surface (convert/gamut/contrast/ramp/binding):
 *   • `resolveTheme(brandColor, scheme, opts)` → one scheme's ramps + tokens
 *     (`cardSwatches`, and the interactive studio #70 — they want one scheme).
 *   • `buildTokenSet(brandColor, opts)` → both schemes zipped into `light-dark()` pairs
 *     (`EntryScope`, which emits a single block carrying both schemes).
 *
 * The model (#98): the engine emits a **per-role generative ramp** — `brand`, `neutral`,
 * and the four status ramps — as 11 `50…950` steps (a pure perceptual-lightness primitive,
 * `ramp.ts`). The semantic role tokens (`--surface`, `--text`, …) then **bind to ramp
 * steps** (`binding.ts`) rather than being solved in isolation: surfaces pin a fixed
 * neutral step per scheme, and every "readable-on-surface" token binds to the smallest step
 * that clears its contrast target (`minPass`). The one exception is the accent FILL: it is
 * the brand's own identity, so it stays a faithful continuous co-solve anchored at the
 * seed's lightness (the rare exact solve `solveForeground` exists for), with its on-accent
 * label the most chromatic color that clears on the fill (#153 — degrading to a near-white/
 * near-black extreme when the gamut allows no chroma there).
 *
 * Order of operations is fixed: parse defensively → detect the seed's native scheme
 * (auto-direction) → per-scheme seed (dark = reduced chroma) → build the per-scheme ramps →
 * co-solve the accent → resolve the binding schema. The engine bakes literals and NEVER
 * throws — bad input yields the fallback palette.
 *
 * Seed-lightness auto-direction: a single seed represents ONE mode. The engine detects
 * whether the seed is usable as a light-mode primary (clears the UI contrast floor as an
 * accent on a light surface) — if so its native scheme is `light`, otherwise `dark`. In
 * the native scheme the accent is anchored to the seed's own lightness (brand-faithful);
 * in the other scheme it is derived by scanning lightness for a legible accent.
 */

import { buildRamp } from "./ramp";
import { resolveTokens, type TokenBinding } from "./binding";
import {
  solveAccent,
  solveNativeAccent,
  describeAccent,
  describeOnAccent,
} from "./accent";
import { gamutMap } from "./gamut";
import { parseColor } from "./convert";
import { checkContrast } from "./contrast";
import { CONTRAST_TARGETS } from "./targets";
import { deepFreeze } from "./freeze";
import {
  BRAND_TOKEN_NAMES,
  RAMP_ROLES,
  type BindingPair,
  type BrandTokenName,
  type EngineRules,
  type Gamut,
  type OkLCH,
  type Ramp,
  type RampLabel,
  type RampRole,
  type Scheme,
  type SchemePair,
  type SchemeResult,
  type RampPair,
  type TokenSet,
} from "./types";

export interface EngineOptions {
  /** Target display gamut. Defaults to `srgb` (safe everywhere — see types). */
  gamut?: Gamut;
  /**
   * Generative rules (#101) — lightness distribution, chroma/hue policy, tinted
   * neutrals. Omitted (or any subset omitted) → the documented defaults, which
   * reproduce the un-ruled engine output exactly. The Studio surfaces these (#73).
   */
  rules?: EngineRules;
}

/**
 * Fallback brand seed for unparseable input — a calm slate-blue, in sRGB gamut,
 * chosen so every solved token comfortably clears its target. Deterministic.
 */
const FALLBACK_SEED: OkLCH = { L: 0.55, C: 0.11, H: 264 };

// Status signal colors. The hues are FIXED canonical anchors — NOT derived from the brand
// — because a status color's job is to signal meaning at a glance, and that depends on
// recognizability (error=red is a usability requirement, not a stylistic choice). What
// harmonizes them with the brand is the TREATMENT, not the hue: each gets its own ramp,
// contrast-solved and gamut-mapped against the slot's worst-case surface, per scheme,
// exactly like the brand ramp. (Mirrors the owner's prototype: danger 27 · success 150 ·
// warning 80.)
const STATUS_HUE: Record<"success" | "error" | "warning" | "info", number> = {
  success: 150, // green
  error: 27, // red
  warning: 80, // amber/yellow
  info: 250, // blue
};

// One chroma for every status ramp; per-step gamut-mapping handles the per-hue reality, so
// e.g. warning/yellow correctly desaturates at its dark steps — that is the point of a
// gamut-mapped ramp rather than a uniform ΔL step.
const STATUS_CHROMA = 0.15;

interface SchemeConfig {
  /** Chroma multiplier applied to the brand seed for this scheme (dark dampens). */
  seedChroma: number;
  /** Nominal chroma of the near-neutral ramp — the whisper of brand tint on surfaces/text. */
  neutralChroma: number;
}

const SCHEMES: Record<Scheme, SchemeConfig> = {
  light: {
    seedChroma: 1,
    neutralChroma: 0.01,
  },
  dark: {
    seedChroma: 0.82, // reduced chroma in dark
    neutralChroma: 0.016,
  },
};

/**
 * The baked default binding schema (#98): which ramp step (or fixed value) each semantic
 * token resolves to. Surfaces pin fixed neutral steps — the light end in light mode, the
 * dark end in dark mode (this per-scheme inversion IS the "re-solve per scheme"). Every
 * readable-on-surface token binds via `minPass` against the scheme's worst-case surface.
 * The accent fill / on-accent label defer to the faithful brand co-solve. A `literal`
 * binding (a fixed value per scheme, e.g. a pure-white surface) is supported by the schema
 * for a brand that wants one; the default uses stepped surfaces so they carry the tint.
 *
 * EXPORTED read-only (#150) so the Studio can answer, for any `BrandTokenName`, WHICH kind
 * of binding it is, against WHICH role's ramp, to WHICH `CONTRAST_TARGETS` tier — reading
 * the one mapping the engine solves against rather than hardcoding the 14-row table.
 */
export const DEFAULT_BINDING_SCHEMA: Readonly<
  Record<BrandTokenName, TokenBinding>
> = deepFreeze({
  // Surfaces: page → elevated → higher, from the near-neutral ramp. Light end in light,
  // dark end in dark; `surface-2` is the worst-case surface the `auto` tokens solve on.
  bg: { kind: "step", role: "neutral", light: "50", dark: "950" },
  surface: { kind: "step", role: "neutral", light: "100", dark: "900" },
  "surface-2": { kind: "step", role: "neutral", light: "200", dark: "800" },
  // Near-neutral foregrounds — bound to the neutral ramp (the brand tint desaturates at the
  // dark steps via gamut-mapping, so any hue clears body-text contrast).
  text: { kind: "auto", role: "neutral", target: CONTRAST_TARGETS.bodyText },
  "text-muted": {
    kind: "auto",
    role: "neutral",
    target: CONTRAST_TARGETS.mutedText,
  },
  border: { kind: "auto", role: "neutral", target: CONTRAST_TARGETS.border },
  // Brand identity — the faithful continuous accent + its on-accent label.
  accent: { kind: "accent" },
  "on-accent": { kind: "on-accent" },
  // Brand-colored foregrounds — bound to the full-chroma brand ramp.
  "accent-text": {
    kind: "auto",
    role: "brand",
    target: CONTRAST_TARGETS.accentText,
  },
  "focus-ring": { kind: "auto", role: "brand", target: CONTRAST_TARGETS.ui },
  // Status signals — each bound to its own canonical-hue ramp at the accent-text tier.
  success: {
    kind: "auto",
    role: "success",
    target: CONTRAST_TARGETS.accentText,
  },
  error: { kind: "auto", role: "error", target: CONTRAST_TARGETS.accentText },
  warning: {
    kind: "auto",
    role: "warning",
    target: CONTRAST_TARGETS.accentText,
  },
  info: { kind: "auto", role: "info", target: CONTRAST_TARGETS.accentText },
});

/**
 * The label the `surface-2` step binds to in each scheme — the WORST-CASE surface the `auto`
 * tokens are solved against. Derived from `DEFAULT_BINDING_SCHEMA["surface-2"]` itself, so the
 * surface those tokens solve on can never drift from the `surface-2` token that actually
 * ships (single source of truth; the "AA on every surface" guarantee rests on their being
 * identical). The fallback only fires if the schema retypes `surface-2` off a step binding —
 * a design change a test would catch.
 */
const SURFACE2_LABEL: { light: RampLabel; dark: RampLabel } =
  DEFAULT_BINDING_SCHEMA["surface-2"].kind === "step"
    ? {
        light: DEFAULT_BINDING_SCHEMA["surface-2"].light,
        dark: DEFAULT_BINDING_SCHEMA["surface-2"].dark,
      }
    : { light: "200", dark: "800" };

/**
 * The default step the seed anchors to, keyed off its native direction (#108): a
 * dark-enough seed (light-native) pins the mid `500`; a light seed (dark-native) pins
 * the light `300`. Fully automatic — no UI control.
 */
const ANCHOR_LABEL: Record<Scheme, RampLabel> = {
  light: "500",
  dark: "300",
};

/** Build all six role ramps for one scheme from a per-scheme seed. Only the `brand`
 *  ramp is anchored to the seed (#108); neutral/status stay on the shared scale. The
 *  ramp-tier rules (#101) shape every role; `tintedNeutrals: false` zeroes the neutral
 *  chroma for pure achromatic greys (default `true` — the brand-tinted signature). */
function buildRamps(
  seed: OkLCH,
  cfg: SchemeConfig,
  gamut: Gamut,
  rules: EngineRules = {},
  anchor?: { label: RampLabel; L: number },
): Record<RampRole, Ramp> {
  const hue = seed.H;
  const neutralChroma = (rules.tintedNeutrals ?? true) ? cfg.neutralChroma : 0;
  return {
    brand: buildRamp({ hue, chroma: seed.C, gamut, anchor, rules }),
    neutral: buildRamp({ hue, chroma: neutralChroma, gamut, rules }),
    success: buildRamp({
      hue: STATUS_HUE.success,
      chroma: STATUS_CHROMA,
      gamut,
      rules,
    }),
    error: buildRamp({
      hue: STATUS_HUE.error,
      chroma: STATUS_CHROMA,
      gamut,
      rules,
    }),
    warning: buildRamp({
      hue: STATUS_HUE.warning,
      chroma: STATUS_CHROMA,
      gamut,
      rules,
    }),
    info: buildRamp({
      hue: STATUS_HUE.info,
      chroma: STATUS_CHROMA,
      gamut,
      rules,
    }),
  };
}

/** The worst-case surface (`surface-2`) a scheme's neutral ramp resolves to. */
function surface2Of(ramps: Record<RampRole, Ramp>, scheme: Scheme): OkLCH {
  const label = SURFACE2_LABEL[scheme];
  const step = ramps.neutral.find((s) => s.label === label);
  return (step ?? ramps.neutral[ramps.neutral.length - 1]).color;
}

/**
 * Detect the seed's NATIVE scheme from the seed alone (independent of the scheme being
 * resolved, so both scheme calls agree). The seed is `light`-native when — at its own
 * L/C/H, gamut-mapped, using the LIGHT per-scheme seed (`seedChroma` = 1, so base chroma)
 * — it clears the UI contrast floor (`CONTRAST_TARGETS.ui`) as an accent fill against the light
 * scheme's WORST-CASE surface (`surface-2` light, the neutral ramp step `resolveTheme`
 * uses). If it clears it can serve as a light-mode primary → `light`; if it is too light to
 * read on a light surface → `dark` (the seed is the dark-mode brand, light-mode derived).
 * Deterministic; reuses the same ramp/contrast/gamut primitives as the solve. Never throws.
 */
function detectDirection(
  base: OkLCH,
  gamut: Gamut,
  rules: EngineRules,
): Scheme {
  const cfg = SCHEMES.light;
  // Mirror resolveTheme's light path: per-scheme seed, its ramps, the worst-case surface.
  const seed = gamutMap(
    { L: base.L, C: base.C * cfg.seedChroma, H: base.H },
    gamut,
  );
  const ramps = buildRamps(seed, cfg, gamut, rules);
  const surface2 = surface2Of(ramps, "light");
  // The candidate light-mode primary is the accent anchored at the seed's own lightness.
  const accent = gamutMap({ L: seed.L, C: seed.C, H: seed.H }, gamut);
  return checkContrast(accent, surface2, CONTRAST_TARGETS.ui).passes
    ? "light"
    : "dark";
}

/**
 * Resolve every brand token for ONE scheme, plus the per-role ramps they bind to. The
 * literal `(brandColor, scheme) → { ramps, tokens }` of the architecture signature. Also
 * reports the seed's native `direction` (detected from the seed alone, so both scheme calls
 * agree): the accent honors `seed.L` when this scheme IS the native direction, and is
 * derived otherwise. Pure, deterministic, never throws.
 */
export function resolveTheme(
  brandColor: unknown,
  scheme: Scheme,
  opts: EngineOptions = {},
): SchemeResult {
  const gamut: Gamut = opts?.gamut ?? "srgb";
  const rules = opts?.rules ?? {};
  const parsed = parseColor(brandColor);
  const isFallback = parsed === null;
  const base = parsed ?? FALLBACK_SEED;
  const cfg = SCHEMES[scheme];

  // Auto-direction: the seed's native scheme, detected from the seed alone so both
  // scheme calls agree. Drives whether this scheme's accent is faithful or derived.
  const direction = detectDirection(base, gamut, rules);

  // Per-scheme seed: hold L/H, dampen chroma in dark, then gamut-map.
  const seed = gamutMap(
    { L: base.L, C: base.C * cfg.seedChroma, H: base.H },
    gamut,
  );

  // Seed anchor (#108): pin the brand ramp's default step (keyed off the native
  // direction) to the seed's EXACT lightness, so the seed's own color lands on the ramp.
  const anchorLabel = ANCHOR_LABEL[direction];

  // The per-role generative ramps for this scheme — the primitive the tokens bind to.
  const ramps = buildRamps(seed, cfg, gamut, rules, {
    label: anchorLabel,
    L: seed.L,
  });

  // Foregrounds are solved against the WORST-CASE surface — the one whose lightness is
  // closest to the foreground (surface-2 in both schemes) — so a token that clears its
  // target there also clears it on bg and surface. This guarantees AA on EVERY surface.
  const surface2 = surface2Of(ramps, scheme);

  // Native scheme → faithful to seed.L (fall back to the derived scan if no faithful
  // accent hosts a label). Off scheme → derive the brand from the seed by scanning.
  // `usedNative` records which path ACTUALLY produced the fill — so the report says
  // "derived" (not a huge phantom "nudge") on the rare native seed whose faithful solve
  // found no hostable label and fell through to the scan.
  const nativeSolve =
    scheme === direction ? solveNativeAccent(seed, surface2, gamut) : null;
  const usedNative = nativeSolve !== null;
  const { accent, onAccent } =
    nativeSolve ?? solveAccent(seed, surface2, gamut);

  // The accent/on-accent co-solve provenance (#151): the receipt's truthful source for the
  // brand pair, reported at solve time so the Studio never reverse-engineers native/nudged/
  // derived (or the label pole) by comparing `seed` to `tokens.accent`. Pure functions of the
  // solved colors + which solve path ran — reporting only, no value is perturbed.
  const accentProvenance = describeAccent(accent, seed, usedNative);
  const onAccentProvenance = describeOnAccent(onAccent, accent, seed);

  // Resolve the binding schema: surfaces pin fixed steps, readable tokens run `minPass`,
  // the accent/on-accent defer to the co-solve above. `bindings` reports the winning step
  // per token (the receipt's truthful source), computed at solve time — not re-derived.
  const { tokens, bindings } = resolveTokens(DEFAULT_BINDING_SCHEMA, {
    scheme,
    ramps,
    surface2,
    accent,
    onAccent,
    accentProvenance,
    onAccentProvenance,
  });

  return {
    tokens,
    ramps,
    seed,
    gamut,
    isFallback,
    direction,
    anchorLabel,
    bindings,
  };
}

/**
 * Build a `Record<BrandTokenName, T>` by calling `value` for every token in the
 * canonical `BRAND_TOKEN_NAMES` (types.ts) — since `BrandTokenName` is DERIVED from
 * that list, "visit every token, exactly once" is a compile-time fact, so the lone
 * `as` here (unavoidable — `Object.fromEntries` is typed to a loose index signature)
 * is sound rather than a blind assertion.
 */
function mapTokens<T>(
  value: (name: BrandTokenName) => T,
): Record<BrandTokenName, T> {
  return Object.fromEntries(
    BRAND_TOKEN_NAMES.map((name) => [name, value(name)] as const),
  ) as Record<BrandTokenName, T>;
}

/** Zip both schemes' ramps into a `Record<RampRole, RampPair>` (per-step `light-dark()`). */
function zipRamps(
  light: Record<RampRole, Ramp>,
  dark: Record<RampRole, Ramp>,
): Record<RampRole, RampPair> {
  return Object.fromEntries(
    RAMP_ROLES.map(
      (role) => [role, { light: light[role], dark: dark[role] }] as const,
    ),
  ) as Record<RampRole, RampPair>;
}

/**
 * Build the dual-scheme token set for `EntryScope`: resolves both
 * schemes and zips each token — and each ramp step — into a `{ light, dark }` pair for
 * `light-dark()`. Pure, deterministic, never throws.
 */
export function buildTokenSet(
  brandColor: unknown,
  opts: EngineOptions = {},
): TokenSet {
  const light = resolveTheme(brandColor, "light", opts);
  const dark = resolveTheme(brandColor, "dark", opts);

  // `mapTokens` forces one entry per `BrandTokenName`, so coverage is type-enforced
  // (no `as` cast at the call site).
  const tokens = mapTokens<SchemePair>((name) => ({
    light: light.tokens[name],
    dark: dark.tokens[name],
  }));

  // Zip each token's per-scheme provenance, mirroring how the token values are zipped.
  const bindings = mapTokens<BindingPair>((name) => ({
    light: light.bindings[name],
    dark: dark.bindings[name],
  }));

  return {
    tokens,
    ramps: zipRamps(light.ramps, dark.ramps),
    meta: {
      seed: { light: light.seed, dark: dark.seed },
      gamut: light.gamut,
      isFallback: light.isFallback,
      // Detected from the seed alone, so both scheme results agree — pick either.
      direction: light.direction,
      anchorLabel: light.anchorLabel,
      bindings,
    },
  };
}
