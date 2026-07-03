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
 * The generic, public token names the engine emits, in canonical emission order — the
 * FROZEN semantic contract (#99). Exported so consumers (the freeze-guard test, Sanity
 * author-time validation, the studio receipt) read the one list rather than restating it.
 * The last four are status signal colors — accessible foregrounds at FIXED canonical hues
 * (not brand-derived), harmonized with the slot only through the shared treatment.
 */
export const BRAND_TOKEN_NAMES = [
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
  "success",
  "error",
  "warning",
  "info",
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
   * The `brand` ramp step the seed is anchored to (#108) — that step's lightness IS the
   * seed's (the ramp bends around it), so the seed's own color lands on the ramp. Keyed
   * off `direction` (`500` light-native, `300` dark-native). Only `brand` is anchored.
   */
  anchorLabel: RampLabel;
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
  };
}
