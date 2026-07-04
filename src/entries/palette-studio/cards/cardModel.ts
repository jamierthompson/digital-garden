// The card view-model — reshapes the Studio's single engine run (`DerivedPalette`) into the
// 14 swatch-card records the UI paints (#154). One record per semantic token, each carrying
// BOTH schemes so a card can show its active face and drill into the other on disclosure.
//
// It only READS the engine's output: token values and their solve-time provenance come from
// `DerivedPalette`, the mini-ramp steps from the per-scheme ramps, and the contrast receipt
// from a LIVE `checkContrast` re-measurement of the baked literals (the engine guide's derivation stories + headline claim — real
// receipts, re-measured, never hardcoded). Pure, React-free, DOM-free; never throws.

import {
  checkContrast,
  formatHex,
  formatOklch,
  type BindingStep,
  type BrandTokenName,
  type ContrastCheck,
  type OkLCH,
  type Ramp,
  type Scheme,
} from "@garden/oklch";

import type { DerivedPalette, SchemeView } from "../core/derive";
import {
  CARD_CONTRACT,
  describeTarget,
  type BindingKind,
} from "./cardContract";
import {
  derivationSentence,
  oogNote,
  type AccentFidelity,
} from "./derivationCopy";

/** Below this |ΔL| the accent is treated as faithful to the seed (the phase-1 #151 seam). */
const FAITHFUL_DELTA_L = 0.01;

/** One token resolved for one scheme — everything a card face (or its disclosure) renders. */
export interface SchemeFacet {
  readonly scheme: Scheme;
  readonly value: OkLCH;
  /** The `oklch()` literal — the primary value readout. */
  readonly oklch: string;
  /** The hex/sRGB fallback for the same color. */
  readonly hex: string;
  /** The ramp step this token bound to, or `null` for the accent co-solves. */
  readonly boundStep: BindingStep | null;
  /** The token's role ramp for this scheme (for the mini-ramp), or `null` for the co-solves. */
  readonly ramp: Ramp | null;
  /** True when the bound ramp step had to desaturate to fit the gamut (the engine guide's callout map). */
  readonly oog: boolean;
  /** The live contrast measurement, or `null` for a surface (a canvas, not a foreground). */
  readonly measured: ContrastCheck | null;
  /** The derivation sentence for this scheme — regenerated from the engine output. */
  readonly sentence: string;
}

/** One swatch card — a semantic token, its kind, usage, and both scheme facets. */
export interface SwatchCardData {
  readonly name: BrandTokenName;
  readonly kind: BindingKind;
  readonly usage: string;
  /** The out-of-gamut aside, present only when either scheme's bound step desaturated. */
  readonly oogNote: string | null;
  readonly light: SchemeFacet;
  readonly dark: SchemeFacet;
}

/** The bound step's out-of-gamut flag, read off the role ramp (false when there's no step). */
function stepIsOog(ramp: Ramp | null, boundStep: BindingStep | null): boolean {
  if (!ramp || !boundStep) return false;
  return ramp.find((s) => s.label === boundStep.label)?.oog ?? false;
}

/**
 * The accent's fidelity to the seed for a scheme — phase-1, derived from the resolved value
 * (the #151 seam). `derived` off the native scheme; else `faithful` when the accent kept the
 * seed's lightness, `nudged` when the co-solve had to move it. Replaced wholesale by the
 * engine's co-solve report in task #13.
 */
function accentFidelity(
  value: OkLCH,
  seedL: number,
  scheme: Scheme,
  direction: Scheme,
): AccentFidelity {
  if (scheme !== direction) return "derived";
  return Math.abs(value.L - seedL) <= FAITHFUL_DELTA_L ? "faithful" : "nudged";
}

/** Build one scheme's facet for a token from the derived palette. */
function buildFacet(
  name: BrandTokenName,
  scheme: Scheme,
  palette: DerivedPalette,
): SchemeFacet {
  const contract = CARD_CONTRACT[name];
  const view: SchemeView = palette[scheme];
  const value = view.tokens[name];
  const boundStep = rowStep(palette, name, scheme);
  const ramp = contract.role ? view.ramps[contract.role] : null;
  const oog = stepIsOog(ramp, boundStep);

  const measured: ContrastCheck | null = contract.against
    ? checkContrast(
        value,
        view.tokens[contract.against.bg],
        contract.against.target,
      )
    : null;

  const sentence = derivationSentence({
    kind: contract.kind,
    scheme,
    boundStep,
    otherStep: rowStep(palette, name, scheme === "light" ? "dark" : "light"),
    measured,
    targetPhrase: contract.against
      ? describeTarget(contract.against.target)
      : null,
    direction: palette.direction,
    accentFidelity: accentFidelity(
      value,
      palette.tokenSet.meta.seed[scheme].L,
      scheme,
      palette.direction,
    ),
    onAccentPole: value.L >= 0.5 ? "near-white" : "near-black",
  });

  return {
    scheme,
    value,
    oklch: formatOklch(value),
    hex: formatHex(value),
    boundStep,
    ramp,
    oog,
    measured,
    sentence,
  };
}

/** The bound step for a token in a scheme, straight from the engine's provenance rows. */
function rowStep(
  palette: DerivedPalette,
  name: BrandTokenName,
  scheme: Scheme,
): BindingStep | null {
  const row = palette.rows.find((r) => r.name === name);
  return row ? row[scheme].boundTo : null;
}

/** Reshape a derived palette into the 14 swatch-card records, in canonical token order. */
export function buildCards(palette: DerivedPalette): SwatchCardData[] {
  return palette.rows.map((row) => {
    const contract = CARD_CONTRACT[row.name];
    const light = buildFacet(row.name, "light", palette);
    const dark = buildFacet(row.name, "dark", palette);
    return {
      name: row.name,
      kind: contract.kind,
      usage: contract.usage,
      oogNote: light.oog || dark.oog ? oogNote() : null,
      light,
      dark,
    };
  });
}
