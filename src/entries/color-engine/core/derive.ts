// The Color Engine's headless core — pure, React-free, DOM-free. It re-runs the
// `@garden/oklch` engine on every change and reshapes its output into exactly what the UI
// paints: the two scheme views, the semantic-token table (each token's NAME, the ramp step
// it resolved to, and its per-scheme value), and the automatic anchor readout.
//
// It NEVER reimplements engine math — every color AND every binding receipt comes from
// `buildTokenSet` (the engine reports which ramp step each token bound to). Kept pure and
// separable so #41 can memoize `derivePalette` later without touching a component; the engine
// already never throws, so neither does this.

import {
  buildTokenSet,
  gamutMap,
  parseColor,
  RAMP_ROLES,
  type BindingProvenance,
  type BrandTokenName,
  type Gamut,
  type OkLCH,
  type Ramp,
  type RampLabel,
  type RampRole,
  type Scheme,
  type SchemeTokens,
  type TokenSet,
} from "@garden/oklch";

import type { ColorEngineRules } from "./rules";

/**
 * The parsed seed for the live input readout. `oklch` is `null` exactly when the input
 * failed to parse — the `isFallback` signal the UI shows inline (the engine still bakes a
 * safe palette, so the rest of the tool keeps working). Uses the engine's own parser so the
 * readout can never disagree with what the palette was derived from — and it is **gamut-
 * mapped into the palette's gamut**, so the readout is the exact in-gamut seed the palette
 * derives from, never a half-clamped hybrid (the parser clamps `L` but echoes `C`/`H` raw,
 * so `oklch(9 9 9)` parses to `oklch(1 9 9)` — out of gamut; the map pulls it back in).
 */
export interface ParsedSeed {
  readonly input: string;
  readonly oklch: OkLCH | null;
  readonly isFallback: boolean;
}

// hsl()/hsla() in either modern (space/slash) or legacy (comma) syntax. The engine's
// parser speaks hex / rgb() / oklch() only, but hsl is a common paste format
// (QA-131 D3) — so the Color Engine normalizes it to rgb() before parsing. Alpha is ignored
// (seeds are opaque, matching the engine's rgb handling).
const HSL_RE =
  /^hsla?\(\s*([+-]?\d*\.?\d+)(?:deg)?\s*[,\s]\s*(\d*\.?\d+)%\s*[,\s]\s*(\d*\.?\d+)%\s*(?:[,/]\s*\d*\.?\d+%?\s*)?\)$/i;

/**
 * Normalize a seed the engine can't parse but users commonly paste: hsl()/hsla() becomes
 * rgb() via the CSS Color 4 algorithm (https://www.w3.org/TR/css-color-4/#hsl-to-rgb);
 * anything else passes through untouched for the engine's own parser to judge.
 */
export function normalizeSeedInput(input: string): string {
  const m = HSL_RE.exec(input.trim());
  if (!m) return input;
  const h = ((parseFloat(m[1]) % 360) + 360) % 360;
  const s = Math.min(100, parseFloat(m[2])) / 100;
  const l = Math.min(100, parseFloat(m[3])) / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  const to255 = (v: number): number => Math.round(v * 255);
  return `rgb(${to255(channel(0))} ${to255(channel(8))} ${to255(channel(4))})`;
}

/**
 * Parse a raw seed string for the input readout (accepts hex / rgb() / oklch(), plus
 * hsl() via `normalizeSeedInput`), then gamut-map it into `gamut` so the readout equals
 * the seed the palette actually derives from (`buildTokenSet(...).meta.seed.light` — the
 * parsed seed mapped into the same gamut). A failed parse stays `null` (the fallback
 * signal); a valid parse is always reported in gamut.
 */
export function parseSeed(input: string, gamut: Gamut = "srgb"): ParsedSeed {
  const parsed = parseColor(normalizeSeedInput(input));
  return {
    input,
    oklch: parsed === null ? null : gamutMap(parsed, gamut),
    isFallback: parsed === null,
  };
}

/**
 * One semantic token, resolved for both schemes with each scheme's solve-time binding
 * provenance — the engine's own report (`@garden/oklch`), read verbatim, never value-matched.
 * `BindingProvenance` is a discriminated union on `kind`: `step` (surfaces + every `auto`
 * token) carries the `(role, label)` ramp coordinate; `accent`/`on-accent` carry the
 * continuous co-solve story (native/deltaL, pole/chroma); `null` only for a `literal` binding.
 */
export interface TokenRow {
  readonly name: BrandTokenName;
  readonly light: {
    readonly value: OkLCH;
    readonly boundTo: BindingProvenance;
  };
  readonly dark: { readonly value: OkLCH; readonly boundTo: BindingProvenance };
}

/** Everything the UI needs to paint ONE scheme's boards. */
export interface SchemeView {
  readonly scheme: Scheme;
  readonly ramps: Record<RampRole, Ramp>;
  readonly tokens: SchemeTokens;
}

/** The full derived palette — one engine run, reshaped for the UI. Never throws. */
export interface DerivedPalette {
  /** True when the seed failed to parse and the engine's safe fallback palette is showing. */
  readonly isFallback: boolean;
  /** The seed's native scheme (`anchorLabel`'s side) — a READOUT, anchoring is automatic. */
  readonly direction: Scheme;
  /** The `brand` ramp step the seed is anchored to. */
  readonly anchorLabel: RampLabel;
  readonly gamut: Gamut;
  readonly light: SchemeView;
  readonly dark: SchemeView;
  /** The semantic-token table, in canonical emission order. */
  readonly rows: readonly TokenRow[];
  /** The raw engine output — consumed as-is by the export serializers (#107). */
  readonly tokenSet: TokenSet;
}

/** Project a `TokenSet` into one scheme's `SchemeView` (ramps + tokens for that scheme). */
function schemeView(set: TokenSet, scheme: Scheme): SchemeView {
  const ramps = Object.fromEntries(
    RAMP_ROLES.map((role) => [role, set.ramps[role][scheme]]),
  ) as Record<RampRole, Ramp>;
  const tokens = Object.fromEntries(
    (Object.keys(set.tokens) as BrandTokenName[]).map((name) => [
      name,
      set.tokens[name][scheme],
    ]),
  ) as SchemeTokens;
  return { scheme, ramps, tokens };
}

/**
 * Re-run the engine for a seed + rules + gamut and reshape into `DerivedPalette`. Pure and
 * deterministic: `ColorEngineRules` is structurally `Required<EngineRules>`, so it passes straight
 * through as the engine's `rules`; both schemes are always derived (the Color Engine shows either).
 */
export function derivePalette(
  seed: string,
  rules: ColorEngineRules,
  gamut: Gamut,
): DerivedPalette {
  // Same normalization as parseSeed — the readout and the palette must see ONE seed.
  const set = buildTokenSet(normalizeSeedInput(seed), { gamut, rules });
  const light = schemeView(set, "light");
  const dark = schemeView(set, "dark");

  // The binding step comes straight from the engine's per-scheme provenance report — the
  // truthful source (it names the schema's role even where the brand and neutral ramps
  // numerically converge). No value-matching, no restated continuous-token list.
  const rows: TokenRow[] = (Object.keys(set.tokens) as BrandTokenName[]).map(
    (name) => ({
      name,
      light: {
        value: light.tokens[name],
        boundTo: set.meta.bindings[name].light,
      },
      dark: {
        value: dark.tokens[name],
        boundTo: set.meta.bindings[name].dark,
      },
    }),
  );

  return {
    isFallback: set.meta.isFallback,
    direction: set.meta.direction,
    anchorLabel: set.meta.anchorLabel,
    gamut: set.meta.gamut,
    light,
    dark,
    rows,
    tokenSet: set,
  };
}

/**
 * The plain-English anchor readout the UI shows verbatim (#108) — e.g. "seed pinned to
 * brand·500, deriving from light". A READOUT of the engine's automatic anchoring, never a
 * control. Pure, so it is unit-testable on its own.
 */
export function describeAnchor(palette: {
  anchorLabel: RampLabel;
  direction: Scheme;
}): string {
  return `seed pinned to brand·${palette.anchorLabel}, deriving from ${palette.direction}`;
}
