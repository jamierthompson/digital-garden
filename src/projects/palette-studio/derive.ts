// The Studio's headless core — pure, React-free, DOM-free. It re-runs the frozen
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
  parseColor,
  RAMP_ROLES,
  type BindingStep,
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

import type { StudioRules } from "./rules";

/**
 * The parsed seed for the live input readout. `oklch` is `null` exactly when the input
 * failed to parse — the `isFallback` signal the UI shows inline (the engine still bakes a
 * safe palette, so the rest of the tool keeps working). Uses the engine's own parser so the
 * readout can never disagree with what the palette was derived from.
 */
export interface ParsedSeed {
  readonly input: string;
  readonly oklch: OkLCH | null;
  readonly isFallback: boolean;
}

/** Parse a raw seed string for the input readout (accepts hex / rgb() / oklch()). */
export function parseSeed(input: string): ParsedSeed {
  const oklch = parseColor(input);
  return { input, oklch, isFallback: oklch === null };
}

/**
 * Which ramp step a semantic token bound to — the engine's own binding provenance
 * (`@garden/oklch`), reported at solve time. `null` for the continuously-solved accent fill
 * / on-accent label (and any literal), which are not a discrete ramp step. Aliased to the
 * engine's `BindingStep` so the receipt shape has one source of truth, not a restatement.
 */
export type BoundStep = BindingStep;

/** One semantic token, resolved for both schemes with the ramp step each scheme bound to. */
export interface TokenRow {
  readonly name: BrandTokenName;
  readonly light: { readonly value: OkLCH; readonly boundTo: BoundStep | null };
  readonly dark: { readonly value: OkLCH; readonly boundTo: BoundStep | null };
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
 * deterministic: `StudioRules` is structurally `Required<EngineRules>`, so it passes straight
 * through as the engine's `rules`; both schemes are always derived (the Studio shows either).
 */
export function derivePalette(
  seed: string,
  rules: StudioRules,
  gamut: Gamut,
): DerivedPalette {
  const set = buildTokenSet(seed, { gamut, rules });
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
