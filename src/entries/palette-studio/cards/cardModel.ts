// The card view-model — reshapes the Studio's single engine run (`DerivedPalette`) into the
// 14 swatch-card records the UI paints (#154). One record per semantic token, each carrying
// BOTH schemes so a card can show its active face and drill into the other on disclosure.
//
// It only READS the engine's output: token values and their solve-time provenance (#151) come
// from `DerivedPalette`, the mini-ramp steps from the per-scheme ramps, and the contrast
// receipt from a LIVE `checkContrast` re-measurement of the baked literals — real receipts,
// re-measured, never hardcoded, and never value-matched. Pure, React-free, DOM-free; never throws.

import {
  checkContrast,
  formatHex,
  formatOklch,
  type BindingProvenance,
  type BrandTokenName,
  type ContrastCheck,
  type OkLCH,
  type Ramp,
  type Scheme,
  type StepProvenance,
} from "@garden/oklch";

import type { DerivedPalette, SchemeView } from "../core/derive";
import {
  CARD_CONTRACT,
  describeTarget,
  type BindingKind,
} from "./cardContract";
import { counterpartHint, derivationSentence, stepOf } from "./derivationCopy";

/** One token resolved for one scheme — everything a card face (or its disclosure) renders. */
export interface SchemeFacet {
  readonly scheme: Scheme;
  readonly value: OkLCH;
  /** The `oklch()` literal — the primary value readout. */
  readonly oklch: string;
  /** The hex/sRGB fallback for the same color. */
  readonly hex: string;
  /** The ramp step this token bound to, or `null` for the accent co-solves. */
  readonly boundStep: StepProvenance | null;
  /** The token's role ramp for this scheme (for the mini-ramp), or `null` for the co-solves. */
  readonly ramp: Ramp | null;
  /** True when the bound ramp step had to desaturate to fit the gamut (the oog story). */
  readonly oog: boolean;
  /** The live contrast measurement, or `null` for a surface (a canvas, not a foreground). */
  readonly measured: ContrastCheck | null;
  /** The derivation sentence for this scheme — regenerated from the engine output. */
  readonly sentence: string;
  /** One-line hint of what this token becomes in the OTHER scheme (from that scheme's provenance). */
  readonly counterpart: string;
}

/**
 * One swatch card — a semantic token and both scheme facets. The card shows the ACTIVE scheme
 * (the disclosure/oog aside key off the active facet, chosen at render); the other facet backs
 * the one-line counterpart hint.
 */
export interface SwatchCardData {
  readonly name: BrandTokenName;
  readonly kind: BindingKind;
  readonly usage: string;
  readonly light: SchemeFacet;
  readonly dark: SchemeFacet;
}

/** The bound step's out-of-gamut flag, read off the role ramp (false when there's no step). */
function stepIsOog(
  ramp: Ramp | null,
  boundStep: StepProvenance | null,
): boolean {
  if (!ramp || !boundStep) return false;
  return ramp.find((s) => s.label === boundStep.label)?.oog ?? false;
}

/** One token's solve-time provenance for a scheme, straight from the engine's report. */
function provenanceOf(
  palette: DerivedPalette,
  name: BrandTokenName,
  scheme: Scheme,
): BindingProvenance {
  const row = palette.rows.find((r) => r.name === name);
  return row ? row[scheme].boundTo : null;
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
  const provenance = provenanceOf(palette, name, scheme);
  const boundStep = stepOf(provenance);
  const ramp = contract.role ? view.ramps[contract.role] : null;
  const oog = stepIsOog(ramp, boundStep);

  const measured: ContrastCheck | null = contract.against
    ? checkContrast(
        value,
        view.tokens[contract.against.bg],
        contract.against.target,
      )
    : null;

  const otherProvenance = provenanceOf(
    palette,
    name,
    scheme === "light" ? "dark" : "light",
  );

  const sentence = derivationSentence({
    cardKind: contract.kind,
    scheme,
    provenance,
    targetPhrase: contract.against
      ? describeTarget(contract.against.target)
      : null,
    direction: palette.direction,
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
    counterpart: counterpartHint(contract.kind, scheme, otherProvenance),
  };
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
      light,
      dark,
    };
  });
}
