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

/** The generic, public token names the engine emits. */
export type BrandTokenName =
  | "bg"
  | "surface"
  | "surface-2"
  | "text"
  | "text-muted"
  | "border"
  | "accent"
  | "accent-text"
  | "on-accent"
  | "focus-ring";

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
  /** The parsed, gamut-mapped (and per-scheme chroma-adjusted) brand seed. */
  seed: OkLCH;
  /** Target gamut the colors were mapped into. */
  gamut: Gamut;
  /** True when the input failed to parse and the fallback palette was used. */
  isFallback: boolean;
}

/**
 * The high-level engine output: every brand token, resolved for both schemes,
 * gamut-mapped and contrast-solved. `meta.isFallback` is true when `brandColor`
 * could not be parsed and the safe fallback palette was used.
 */
export interface TokenSet {
  tokens: Record<BrandTokenName, SchemePair>;
  meta: {
    /** The parsed, gamut-mapped brand seed (or the fallback seed) per scheme. */
    seed: SchemePair;
    /** Target gamut the literals were mapped into. */
    gamut: Gamut;
    /** True when the input failed to parse and the fallback palette was used. */
    isFallback: boolean;
  };
}
