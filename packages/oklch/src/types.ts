/**
 * Shared types for the OKLCH theming engine.
 *
 * The engine is PURE and ISOMORPHIC: no `next/*`, no `react`, no DOM/Node
 * globals, and never `server-only`/`client-only`. These types describe colors and
 * the token set it bakes server-side as literal `oklch()` values.
 */

/** A color in the OKLab cylindrical space (Björn Ottosson, 2020). */
export interface OkLCH {
  /** Perceptual lightness, 0 (black) → 1 (white). NOT WCAG luminance or APCA Lc. */
  L: number;
  /** Chroma, 0 (grey) → ~0.4. Routinely exceeds sRGB/P3 and must be gamut-mapped. */
  C: number;
  /** Hue angle in degrees, 0–360. Undefined for greys (C === 0); kept for stability. */
  H: number;
  /**
   * Optional opacity, 0 (transparent) → 1 (opaque). Omitted means fully opaque — every
   * solved token is opaque; only a `literal` alpha token (`scrim`, #160) sets it. Alpha is
   * a SERIALIZATION concern: it rides through gamut-mapping and contrast math untouched
   * (both read L/C/H only — a scrim carries no contrast claim), and the format layer emits it
   * as `oklch(L C H / a)` / 8-digit hex / `rgb(r g b / a)` / the DTCG `alpha` field.
   */
  alpha?: number;
}

/** A color in the OKLab rectangular space. */
export interface OkLab {
  L: number;
  a: number;
  b: number;
}

/** Gamma-encoded sRGB (or Display-P3) channels, each 0–1. */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Render-time color scheme axis — one `brandColor` generates both. */
export type Scheme = "light" | "dark";

/**
 * Target display gamut for mapping before contrast math. `srgb` is the safe
 * default: a literal mapped into sRGB renders identically on every display and its
 * solved contrast holds on the lowest-common-denominator screen. `p3` is available
 * explicitly for wide-gamut brand colors when the consumer opts in.
 */
export type Gamut = "srgb" | "p3";

/**
 * Export value serialization (#99, for the studio export #107). `oklch` is the engine's
 * native, lossless form; `hex`/`rgb` serialize the gamut-mapped sRGB rendering of each
 * color (identical paint for the default `srgb` gamut; a P3 literal is clamped — the
 * lowest-common-denominator downconversion).
 */
export type ColorFormat = "oklch" | "hex" | "rgb";

/**
 * Generative rules (#101) — how the ramp-primitive tier is SHAPED, before the semantic
 * tokens bind to it. Deterministic, isomorphic engine inputs; the Studio surfaces them
 * ("Rules · set once", #73). Every default reproduces the engine's un-ruled output.
 */

/**
 * How the steps space in lightness. `tailwind` (default) is the engine's hand-shaped
 * scale — denser at both extremes so each end yields three close-spaced surfaces. The
 * named curves reshape the five INTERIOR steps (`300…700`) between pinned shoulders
 * (`50/100/200` + `800/900/950` never move — they host the surfaces and the extreme
 * fallbacks, which is what keeps the contrast guarantees intact under every policy):
 * `linear` an even interior march, `eased` a smoothstep, `punchy` a steep mid,
 * `soft` a low-contrast band huddled toward the middle.
 */
export type LightnessDistribution =
  | "tailwind"
  | "linear"
  | "eased"
  | "punchy"
  | "soft";

/**
 * How nominal chroma varies across the steps. `flat` (default) holds the nominal chroma
 * at every step (the per-step gamut map still desaturates what can't fit); `taper` pulls
 * chroma away from the lightest + darkest steps (a sine bell); `hold` keeps chroma
 * pushing into the darks (a flatter bell).
 */
export type ChromaPolicy = "flat" | "taper" | "hold";

/**
 * Subtle per-step hue drift. `constant` (default) holds the hue; `warm-shadows` drifts
 * darker steps warmer (up to ±9°); `cool-highlights` drifts lighter steps cooler (the
 * mirror curve).
 */
export type HuePolicy = "constant" | "warm-shadows" | "cool-highlights";

/** The ramp-tier rules `buildRamp` understands (per-ramp shaping). */
export interface RampRules {
  distribution?: LightnessDistribution;
  chromaPolicy?: ChromaPolicy;
  huePolicy?: HuePolicy;
}

/**
 * The full engine rule set (#101): the ramp-tier shaping plus `tintedNeutrals` — whether
 * the neutral ramp leans toward the brand hue (default `true`, the engine's signature
 * brand-tinted greys; `false` yields pure achromatic greys).
 */
export interface EngineRules extends RampRules {
  tintedNeutrals?: boolean;
}

/**
 * The generic, public token names the engine emits, in canonical emission order — the
 * FROZEN semantic contract (#99, completed to the 34-token model in #160). Exported so
 * consumers (the freeze-guard test, Sanity author-time validation, the studio receipt) read
 * the one list rather than restating it.
 *
 * Emission order: the core 10, then a per-status block ×4 (`error`/`warning`/`success`/`info`)
 * of fill · on-fill · text · container · on-container, then the three interaction states
 * (`accent-hover`, `surface-hover`, `surface-selected`), then the `scrim` overlay literal. The
 * status roles carry FIXED canonical hues (not brand-derived), harmonized with the slot only
 * through the shared contrast treatment. The two neutral interaction surfaces pin darker steps
 * of the neutral ramp (light mode: bg > surface > surface-2 > surface-hover > surface-selected
 * by increasing darkness; dark mode mirrors), and `surface-selected` — the darkest text-bearing
 * surface — is the worst-case background every `auto` foreground is solved against, so `text`/
 * `text-muted`/`border` clear their targets on EVERY surface including the state ones.
 */
export const BRAND_TOKEN_NAMES = [
  // Core (10) — unchanged.
  "bg",
  "surface",
  "surface-2",
  "text",
  "text-muted",
  "border",
  "accent",
  "accent-text",
  "on-accent",
  "focus-ring",
  // Status blocks (×4): fill · on-fill · text · container · on-container.
  "error",
  "on-error",
  "error-text",
  "error-container",
  "on-error-container",
  "warning",
  "on-warning",
  "warning-text",
  "warning-container",
  "on-warning-container",
  "success",
  "on-success",
  "success-text",
  "success-container",
  "on-success-container",
  "info",
  "on-info",
  "info-text",
  "info-container",
  "on-info-container",
  // Interaction states (×3) + overlay.
  "accent-hover",
  "surface-hover",
  "surface-selected",
  "scrim",
] as const;

/** One generic, public token name. */
export type BrandTokenName = (typeof BRAND_TOKEN_NAMES)[number];

/**
 * The 11 ramp step labels — Tailwind-style `50…950`. Ordered lightest → darkest, so a
 * consumer reads them 1:1 against a Tailwind numeric scale. The public *label* scheme (how
 * a token displays which step it binds to) is owned by #99; these are the engine-internal
 * primitive labels the semantic tokens bind against.
 */
export const RAMP_LABELS = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

/** One ramp step label. */
export type RampLabel = (typeof RAMP_LABELS)[number];

/**
 * The roles the engine emits a generative ramp for, in canonical emission order: the
 * `brand` ramp (full seed chroma), the near-neutral `neutral` ramp (surfaces +
 * near-neutral text/border bind to it), and one ramp per canonical status hue. Role→step
 * binding is a *separate* layer (the semantic tokens); this is the pure lightness
 * primitive behind them. Part of the frozen contract (#99), exported like
 * `BRAND_TOKEN_NAMES`.
 */
export const RAMP_ROLES = [
  "brand",
  "neutral",
  "success",
  "error",
  "warning",
  "info",
] as const;

/** One ramp role. */
export type RampRole = (typeof RAMP_ROLES)[number];

/** One resolved ramp step: its label, the gamut-mapped color, and the out-of-gamut flag. */
export interface RampStep {
  label: RampLabel;
  /** The gamut-mapped color for this step (always in the target gamut). */
  color: OkLCH;
  /**
   * True when the ramp's *nominal* (pre-map) chroma exceeded the target gamut at this
   * step's lightness — i.e. `color` was chroma-reduced to fit. The surfaced OOG flag (#98).
   */
  oog: boolean;
}

/** A role's ramp: the 11 steps, ordered `50` (lightest) → `950` (darkest). */
export type Ramp = readonly RampStep[];

/** One role's ramp resolved for both schemes — zipped into `light-dark()` per step. */
export interface RampPair {
  light: Ramp;
  dark: Ramp;
}

/** One token resolved per scheme — both baked into a `light-dark()` literal. */
export interface SchemePair {
  light: OkLCH;
  dark: OkLCH;
}

/** Every brand token resolved for a SINGLE scheme (Consumers B & C). */
export type SchemeTokens = Record<BrandTokenName, OkLCH>;

/**
 * The discrete ramp step a semantic token bound to — the `(role, label)` the binding layer
 * chose at solve time (surfaces pin a fixed step; `auto` tokens land the `minPass` step).
 */
export interface BindingStep {
  role: RampRole;
  label: RampLabel;
}

/** Provenance for a token that bound to a discrete ramp step (surfaces + every `auto`
 *  token): the `(role, label)` coordinate, tagged for the `BindingProvenance` union. */
export interface StepProvenance extends BindingStep {
  kind: "step";
}

/**
 * Provenance for a co-solved FILL (#151, generalized #160): the brand `accent`, `accent-hover`,
 * and every status fill (`error`/`warning`/`success`/`info`) share this one shape — a fill that
 * is co-solved for UI visibility AND to host a legible label. `role` names the identity so the
 * receipt is truthful (a status fill reports its status role, NEVER "accent"/"brand" by accident;
 * a brand fill reports `"brand"`). `hue` is the fill's own hue (the seed's for brand fills; the
 * fixed canonical hue for status).
 *
 * `seed` is the brand-seed faithfulness story, present ONLY for the brand-hue fills (`accent`,
 * `accent-hover`) and `null` for the fixed-canonical-hue status fills (which have no seed
 * relationship): `native` is true when the fill was solved on its FAITHFUL native path (this
 * scheme is the seed's direction AND a faithful fill hosting a label existed) — `false`
 * off-scheme, on the derived-fallback edge, and for `accent-hover` (a derived hover, not the
 * seed anchor). `deltaL` is the signed `fill.L − seed.L`, so a consumer narrates a hover as
 * `accentHover.deltaL − accent.deltaL` (provenance-to-provenance, never a color comparison).
 */
export interface FillProvenance {
  kind: "fill";
  role: RampRole;
  hue: number;
  seed: { native: boolean; deltaL: number } | null;
}

/**
 * Provenance for a co-solved LABEL on a fill (#151/#153, generalized #160): `on-accent` and
 * every `on-<status>`. `role` names which fill it labels (truthful receipts). `pole` is which
 * extreme the label sits toward relative to the fill — near-white vs near-black, the headroom
 * polarity (#95). `hue`/`chroma` are the label's own: `chroma` 0 for the achromatic extreme,
 * `> 0` for the chromatic color-on-color solve (#153). `backedOff` is true when the label
 * carries LESS chroma than the fill's seed asked for (the achromatic extreme is the C→0 limit).
 */
export interface OnFillProvenance {
  kind: "on-fill";
  role: RampRole;
  pole: "white" | "black";
  hue: number;
  chroma: number;
  backedOff: boolean;
}

/**
 * Provenance for a `literal` binding — a fixed value with no derivation to solve (#160). The
 * only field that carries a story is `alpha` (the scrim's opacity; 1 for an opaque literal); a
 * literal makes NO contrast claim, so there is nothing else to receipt. Replaces the old bare
 * `null` for literals — every token now carries a first-class report (the batteries-included
 * constitution). `null` remains in the union only as the reserved "no binding" sentinel.
 */
export interface LiteralProvenance {
  kind: "literal";
  alpha: number;
}

/**
 * A token's binding provenance (#70/#151, generalized #160): the solve-time story the receipt
 * reads instead of reverse-engineering it. A discriminated union on `kind`: `step` for a
 * discrete ramp step (surfaces + `auto` tokens + containers + state steps), `fill`/`on-fill`
 * for the co-solved brand+status fills and their labels, `literal` for a fixed value (scrim).
 * Reported by the binding layer AT SOLVE TIME — never value-matched (a scan lies when the brand
 * and neutral ramps converge, e.g. an achromatic seed or `tintedNeutrals: false`). `null` is a
 * reserved sentinel; no default token binds to it.
 */
export type BindingProvenance =
  | StepProvenance
  | FillProvenance
  | OnFillProvenance
  | LiteralProvenance
  | null;

/** One token's binding provenance for both schemes — zipped like the token values. */
export interface BindingPair {
  light: BindingProvenance;
  dark: BindingProvenance;
}

/** Per-scheme engine result — the literal `(brandColor, scheme) → tokenSet` shape. */
export interface SchemeResult {
  tokens: SchemeTokens;
  /**
   * The generative per-role ramps for THIS scheme — the `50…950` lightness primitives the
   * semantic `tokens` bind to. Exposed so the studio (#70) and card ramp strip (#96) can
   * read the raw steps rather than re-deriving them.
   */
  ramps: Record<RampRole, Ramp>;
  /** The parsed, gamut-mapped (and per-scheme chroma-adjusted) brand seed. */
  seed: OkLCH;
  /** Target gamut the colors were mapped into. */
  gamut: Gamut;
  /** True when the input failed to parse and the fallback palette was used. */
  isFallback: boolean;
  /**
   * The seed's NATIVE scheme — the one whose accent honors the seed's own lightness.
   * Detected from the seed alone (scheme-independent), so both `resolveTheme(c,"light")`
   * and `resolveTheme(c,"dark")` report the same value: `"light"` when the seed can serve
   * as a light-mode primary (clears the UI floor on a light surface), else `"dark"`. In
   * the native scheme the accent is anchored at `seed.L` (nudged only minimally, if needed,
   * to host a legible on-accent label); in the other scheme it is derived.
   */
  direction: Scheme;
  /**
   * The `brand` ramp step the seed is anchored to (#108) — that step's lightness is the
   * seed's (the ramp bends around it), so the seed's own color lands on the ramp. Keyed
   * off `direction` (`500` light-native, `300` dark-native). Only `brand` is anchored.
   * Caveat (QA-108): the pin is exact only for a seed L inside the scale's open interval
   * (~0.15…0.98); a near-white/near-black seed is CLAMPED just inside it, so for those
   * the step is close to — not exactly — the seed's L.
   */
  anchorLabel: RampLabel;
  /**
   * Per-token binding provenance for THIS scheme (#109, #151): the solve-time story of each
   * semantic token — a `step` `(role, label)` for ramp-bound tokens, a first-class `accent`/
   * `on-accent` co-solve report for the continuous brand pair, `null` only for a `literal`.
   * The truthful source for a "`--text` → `neutral · 800`" receipt AND the accent's
   * faithful/nudged/derived + label-pole story — a value-scan cannot tell brand from neutral
   * when the two ramps converge, nor recover the co-solve. Reporting only: every `tokens`
   * value is unchanged by its presence.
   */
  bindings: Record<BrandTokenName, BindingProvenance>;
}

/**
 * The high-level engine output: every brand token, resolved for both schemes,
 * gamut-mapped and contrast-solved. `meta.isFallback` is true when `brandColor`
 * could not be parsed and the safe fallback palette was used.
 */
export interface TokenSet {
  tokens: Record<BrandTokenName, SchemePair>;
  /**
   * The per-role `50…950` ramps, each zipped into a `{ light, dark }` pair for
   * `light-dark()` output (`tokenSetToCss` emits them as `--<role>-<step>` alongside the
   * semantic tokens). The primitive tier the semantic tokens are bound from (#98).
   */
  ramps: Record<RampRole, RampPair>;
  meta: {
    /** The parsed, gamut-mapped brand seed (or the fallback seed) per scheme. */
    seed: SchemePair;
    /** Target gamut the literals were mapped into. */
    gamut: Gamut;
    /** True when the input failed to parse and the fallback palette was used. */
    isFallback: boolean;
    /**
     * The seed's native scheme — the one whose accent honors the seed's own lightness
     * (`"light"` for a seed usable as a light-mode primary, else `"dark"`). Detected from
     * the seed alone, so it is a single value for the set, not a per-scheme pair.
     */
    direction: Scheme;
    /** The `brand` ramp step the seed is anchored to (#108) — see `SchemeResult`. */
    anchorLabel: RampLabel;
    /**
     * Per-token binding provenance (#70, #151), zipped `{ light, dark }` per token — the
     * `step` `(role, label)` each ramp-bound token landed, the `accent`/`on-accent` co-solve
     * report for the continuous brand pair, `null` only for a `literal`. The truthful source
     * for the Studio's binding receipt. Reporting only: every `tokens` value is unchanged by it.
     */
    bindings: Record<BrandTokenName, BindingPair>;
  };
}
