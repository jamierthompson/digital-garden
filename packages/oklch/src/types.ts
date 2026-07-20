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

/** Render-time color scheme axis — one `themeColor` generates both. */
export type Scheme = "light" | "dark";

/**
 * Target display gamut for mapping before contrast math. `srgb` is the safe
 * default: a literal mapped into sRGB renders identically on every display and its
 * solved contrast holds on the lowest-common-denominator screen. `p3` is available
 * explicitly for wide-gamut theme colors when the consumer opts in.
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
 * scale — denser at each end, so whichever end a scheme uses yields five close-spaced
 * surfaces. The named curves reshape only the active scheme's TEXT-ZONE interior — the run
 * of non-surface steps between the innermost surface and the far text extreme — while the
 * five surface steps and the extreme text step stay PINNED (which is what keeps the contrast
 * guarantees intact under every policy): `linear` an even interior march, `eased` a
 * smoothstep, `punchy` a steep mid, `soft` a low-contrast band huddled toward the middle.
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
 * the neutral ramp leans toward the accent hue (default `true`, the engine's signature
 * accent-tinted greys; `false` yields pure achromatic greys).
 */
export interface EngineRules extends RampRules {
  tintedNeutrals?: boolean;
}

/**
 * The generic, public token names the engine emits, in canonical emission order — the
 * drift-guarded semantic surface (#99, completed to the 34-token model in #160, extended to
 * the 37-token model in #229 — the neutral `muted` background + the `accent-subtle` pair —
 * to 38 with the neutral `icon` ink, and to 59 with the harmony blocks, #334; freely
 * changeable since the engine is internal/single-consumer). Exported so consumers (the
 * drift-guard test, Sanity author-time validation, the studio receipt) read the one list
 * rather than restating it.
 *
 * `icon` fills the gap in the neutral ink ramp at the `ui` tier (Lc 45): non-text graphics are
 * governed by WCAG 2.2 SC 1.4.11 at 3:1, so an icon may not read a 4.5-solved text role. The
 * neutral ramp now runs foreground (Lc 75) → muted-foreground (60) → icon (45) → border (30).
 *
 * Emission order: the core 14, then a per-status block ×4 (`error`/`warning`/`success`/`info`)
 * of fill · fill-foreground · text · subtle · subtle-foreground, then a per-harmony-hue block ×7
 * (#334) of decorative anchor · fill · text, then the three interaction states
 * (`accent-hover`, `surface-hover`, `surface-selected`), then the `scrim` overlay literal.
 *
 * The harmony blocks bind the harmony tier (#152) into the guarded surface: per derived hue,
 * the bare `harmony-<hue>` is the DECORATIVE seed-grade identity color — the hue's ramp step
 * at the seed anchor (#108), carrying NO contrast claim (washes, gradients, large non-text
 * shapes) — while `harmony-<hue>-fill` (`ui`: 3:1 + Lc 45) and `harmony-<hue>-text`
 * (`accentText`: 4.5:1 + Lc 60) are solved against the worst-case surface exactly like their
 * accent counterparts, so they hold on EVERY standard surface. There is deliberately no
 * `harmony-<hue>-foreground` (a label ON a harmony fill) and no `harmony-<hue>-subtle` pair
 * yet — those are future extensions that follow the status-block pattern when a real job
 * needs them. The
 * status roles carry FIXED canonical hues (not seed-derived), harmonized with the slot only
 * through the shared contrast treatment. The two neutral interaction surfaces pin darker steps
 * of the neutral ramp (light mode: background > surface > surface-elevated > surface-hover >
 * surface-selected by increasing darkness; dark mode mirrors), and `surface-selected` — the
 * darkest text-bearing surface — is the worst-case background every `auto` foreground is solved
 * against, so `foreground`/`muted-foreground`/`border` clear their targets on EVERY surface
 * including the state ones.
 */
export const THEME_TOKEN_NAMES = [
  // Core (14)
  "background",
  "surface",
  "surface-elevated",
  "foreground",
  "muted",
  "muted-foreground",
  "icon",
  "border",
  "accent",
  "accent-text",
  "accent-foreground",
  "accent-subtle",
  "accent-subtle-foreground",
  "ring",
  // Status blocks (×4): fill · fill-foreground · text · subtle · subtle-foreground.
  "error",
  "error-foreground",
  "error-text",
  "error-subtle",
  "error-subtle-foreground",
  "warning",
  "warning-foreground",
  "warning-text",
  "warning-subtle",
  "warning-subtle-foreground",
  "success",
  "success-foreground",
  "success-text",
  "success-subtle",
  "success-subtle-foreground",
  "info",
  "info-foreground",
  "info-text",
  "info-subtle",
  "info-subtle-foreground",
  // Harmony blocks (×7, #334): decorative anchor · fill · text.
  "harmony-analogous-a",
  "harmony-analogous-a-fill",
  "harmony-analogous-a-text",
  "harmony-analogous-b",
  "harmony-analogous-b-fill",
  "harmony-analogous-b-text",
  "harmony-complementary",
  "harmony-complementary-fill",
  "harmony-complementary-text",
  "harmony-triadic-a",
  "harmony-triadic-a-fill",
  "harmony-triadic-a-text",
  "harmony-triadic-b",
  "harmony-triadic-b-fill",
  "harmony-triadic-b-text",
  "harmony-split-complementary-a",
  "harmony-split-complementary-a-fill",
  "harmony-split-complementary-a-text",
  "harmony-split-complementary-b",
  "harmony-split-complementary-b-fill",
  "harmony-split-complementary-b-text",
  // Interaction states (×3) + overlay.
  "accent-hover",
  "surface-hover",
  "surface-selected",
  "scrim",
] as const;

/** One generic, public token name. */
export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];

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
 * `accent` ramp (full seed chroma), the near-neutral `neutral` ramp (surfaces +
 * near-neutral text/border bind to it), one ramp per canonical status hue, and one ramp
 * per derived harmony hue (#334 — seed chroma at the rotated hue, seed-anchored like the
 * accent ramp; the `harmony-<hue>` semantic blocks bind to these). Role→step
 * binding is a *separate* layer (the semantic tokens); this is the pure lightness
 * primitive behind them. Part of the drift-guarded surface (#99), exported like
 * `THEME_TOKEN_NAMES`.
 */
export const RAMP_ROLES = [
  "accent",
  "neutral",
  "success",
  "error",
  "warning",
  "info",
  "harmony-analogous-a",
  "harmony-analogous-b",
  "harmony-complementary",
  "harmony-triadic-a",
  "harmony-triadic-b",
  "harmony-split-complementary-a",
  "harmony-split-complementary-b",
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

/** Every theme token resolved for a SINGLE scheme (Consumers B & C). */
export type SchemeTokens = Record<ThemeTokenName, OkLCH>;

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
 * Provenance for a co-solved FILL (#151, generalized #160): the `accent` and `accent-hover` fills,
 * and every status fill (`error`/`warning`/`success`/`info`) share this one shape — a fill that
 * is co-solved for UI visibility AND to host a legible label. `role` names the identity so the
 * receipt is truthful (a status fill reports its status role, NEVER "accent" by accident;
 * an accent fill reports `"accent"`). `hue` is the fill's own hue (the seed's for accent fills; the
 * fixed canonical hue for status).
 *
 * `seed` is the theme-seed faithfulness story, present ONLY for the accent-hue fills (`accent`,
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
 * Provenance for a co-solved LABEL on a fill (#151/#153, generalized #160): `accent-foreground` and
 * every `<status>-foreground`. `role` names which fill it labels (truthful receipts). `pole` is which
 * extreme the label sits toward relative to the fill — near-white vs near-black, the headroom
 * polarity (#95). `hue`/`chroma` are the label's own: `chroma` 0 for the achromatic extreme,
 * `> 0` for the chromatic color-on-color solve (#153). `backedOff` is true when the label
 * carries LESS chroma than the fill's seed asked for (the achromatic extreme is the C→0 limit).
 */
export interface FillForegroundProvenance {
  kind: "fill-foreground";
  role: RampRole;
  pole: "white" | "black";
  hue: number;
  chroma: number;
  backedOff: boolean;
}

/**
 * Provenance for a `literal` binding — a fixed value with no derivation to solve (#160). The
 * only field that carries a story is `alpha` (the scrim's opacity; 1 for an opaque literal); a
 * literal makes NO contrast claim, so there is nothing else to receipt. Every token carries a
 * first-class report; `null` is the union's reserved "no binding" sentinel.
 */
export interface LiteralProvenance {
  kind: "literal";
  alpha: number;
}

/**
 * A token's binding provenance (#70/#151, generalized #160): the solve-time story the receipt
 * reads instead of reverse-engineering it. A discriminated union on `kind`: `step` for a
 * discrete ramp step (surfaces + `auto` tokens + subtle surfaces + state steps), `fill`/`fill-foreground`
 * for the co-solved accent+status fills and their labels, `literal` for a fixed value (scrim).
 * Reported by the binding layer AT SOLVE TIME — never value-matched (a scan lies when the accent
 * and neutral ramps converge, e.g. an achromatic seed or `tintedNeutrals: false`). `null` is a
 * reserved sentinel; no default token binds to it.
 */
export type BindingProvenance =
  | StepProvenance
  | FillProvenance
  | FillForegroundProvenance
  | LiteralProvenance
  | null;

/** One token's binding provenance for both schemes — zipped like the token values. */
export interface BindingPair {
  light: BindingProvenance;
  dark: BindingProvenance;
}

/** Per-scheme engine result — the literal `(themeColor, scheme) → tokenSet` shape. */
export interface SchemeResult {
  tokens: SchemeTokens;
  /**
   * The generative per-role ramps for THIS scheme — the `50…950` lightness primitives the
   * semantic `tokens` bind to. Exposed so the studio (#70) and card ramp strip (#96) can
   * read the raw steps rather than re-deriving them.
   */
  ramps: Record<RampRole, Ramp>;
  /** The parsed, gamut-mapped (and per-scheme chroma-adjusted) theme seed. */
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
   * to host a legible accent-foreground label); in the other scheme it is derived.
   */
  direction: Scheme;
  /**
   * The `accent` ramp step the seed is anchored to (#108) — that step's lightness is the
   * seed's (the ramp bends around it), so the seed's own color lands on the ramp. Keyed
   * off `direction` (`500` light-native, `300` dark-native). Only `accent` is anchored.
   * Caveat (QA-108): the pin is exact only for a seed L inside the scale's open interval
   * (~0.15…0.98); a near-white/near-black seed is CLAMPED just inside it, so for those
   * the step is close to — not exactly — the seed's L.
   */
  anchorLabel: RampLabel;
  /**
   * Per-token binding provenance for THIS scheme (#109, #151): the solve-time story of each
   * semantic token — a `step` `(role, label)` for ramp-bound tokens, a first-class `accent`/
   * `accent-foreground` co-solve report for the continuous accent pair, `null` only for a `literal`.
   * The truthful source for a "`--foreground` → `neutral · 800`" receipt AND the accent's
   * faithful/nudged/derived + label-pole story — a value-scan cannot tell accent from neutral
   * when the two ramps converge, nor recover the co-solve. Reporting only: every `tokens`
   * value is unchanged by its presence.
   */
  bindings: Record<ThemeTokenName, BindingProvenance>;
}

/**
 * The high-level engine output: every theme token, resolved for both schemes,
 * gamut-mapped and contrast-solved. `meta.isFallback` is true when `themeColor`
 * could not be parsed and the safe fallback palette was used.
 */
export interface TokenSet {
  tokens: Record<ThemeTokenName, SchemePair>;
  /**
   * The per-role `50…950` ramps, each zipped into a `{ light, dark }` pair for
   * `light-dark()` output (`rampSetToDeclarations` emits them as `--<role>-<step>`). The
   * primitive tier the semantic tokens are bound from (#98).
   */
  ramps: Record<RampRole, RampPair>;
  meta: {
    /** The parsed, gamut-mapped theme seed (or the fallback seed) per scheme. */
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
    /** The `accent` ramp step the seed is anchored to (#108) — see `SchemeResult`. */
    anchorLabel: RampLabel;
    /**
     * Per-token binding provenance (#70, #151), zipped `{ light, dark }` per token — the
     * `step` `(role, label)` each ramp-bound token landed, the `accent`/`accent-foreground` co-solve
     * report for the continuous accent pair, `null` only for a `literal`. The truthful source
     * for the Studio's binding receipt. Reporting only: every `tokens` value is unchanged by it.
     */
    bindings: Record<ThemeTokenName, BindingPair>;
  };
}
