import { describe, expect, it } from "vitest";

import {
  BRAND_TOKEN_NAMES,
  type FillProvenance,
  type OnFillProvenance,
  type RampLabel,
  type RampRole,
  type StepProvenance,
} from "@garden/oklch";

import { derivePalette } from "../core/derive";
import { DEFAULT_GAMUT, DEFAULT_RULES } from "../core/rules";
import { buildCards } from "./cardModel";
import {
  counterpartHint,
  derivationSentence,
  fillDerivation,
  fillHoverDerivation,
  formatStep,
  oogNote,
  onFillDerivation,
  stepOf,
  type DerivationInput,
} from "./derivationCopy";

const step = (
  label: RampLabel,
  role: RampRole = "neutral",
): StepProvenance => ({ kind: "step", role, label });

/** A brand fill provenance (seed present) with sensible defaults. */
const brandFill = (
  seed: { native: boolean; deltaL: number } | null,
): FillProvenance => ({ kind: "fill", role: "brand", hue: 264, seed });

/** A complete `DerivationInput` with sensible defaults; override per case. */
function input(overrides: Partial<DerivationInput>): DerivationInput {
  return {
    cardKind: "auto",
    scheme: "light",
    provenance: null,
    targetPhrase: null,
    direction: "light",
    ...overrides,
  };
}

describe("formatStep / stepOf", () => {
  it("prints a step provenance as 'role · label'", () => {
    expect(formatStep(step("800"))).toBe("neutral · 800");
    expect(formatStep(step("500", "brand"))).toBe("brand · 500");
  });

  it("narrows only step provenance, null for the co-solves", () => {
    expect(stepOf(step("800"))).toEqual(step("800"));
    expect(stepOf(brandFill({ native: true, deltaL: 0 }))).toBeNull();
    expect(stepOf(null)).toBeNull();
  });
});

describe("derivationSentence — plain language first", () => {
  it("step: a fixed background shade, plain first then the shade coordinate", () => {
    const sentence = derivationSentence(
      input({ cardKind: "step", provenance: step("100") }),
    );
    expect(sentence).toMatch(/fixed background shade/i);
    expect(sentence).toContain("100 shade of your neutral scale");
    // No color-science jargon on the face beyond the glossed coordinate.
    expect(sentence).not.toMatch(/contrast-solved|minPass|APCA/i);
  });

  it("auto: auto-picked + the readability target it must clear (measurement lives on the chip)", () => {
    const sentence = derivationSentence(
      input({
        cardKind: "auto",
        provenance: step("800"),
        targetPhrase: "4.5:1 and Lc 75",
      }),
    );
    expect(sentence).toMatch(/auto-picked/i);
    expect(sentence).toMatch(/easy to read/i);
    expect(sentence).toContain("clear 4.5:1 and Lc 75");
    // The live measurement is NOT duplicated in the sentence (the ContrastChip owns it).
    expect(sentence).not.toMatch(/measured/i);
  });

  it("auto-on: names the container it's solved against + the target", () => {
    const sentence = derivationSentence(
      input({
        cardKind: "auto-on",
        provenance: step("800", "error"),
        targetPhrase: "4.5:1 and Lc 60",
      }),
    );
    expect(sentence).toMatch(/auto-picked/i);
    expect(sentence).toMatch(/error container/i);
    expect(sentence).toContain("800 shade of your error scale");
    expect(sentence).toContain("clear 4.5:1 and Lc 60");
  });

  it("literal: unmeasured by design — names the opacity, makes no contrast claim", () => {
    const sentence = derivationSentence(
      input({ cardKind: "literal", provenance: { kind: "literal", alpha: 0.5 } }),
    );
    expect(sentence).toMatch(/unmeasured by design/i);
    expect(sentence).toContain("50% opacity");
    expect(sentence).toMatch(/no contrast claim/i);
  });
});

describe("fillDerivation — the co-solve story (#151/#160), plain", () => {
  it("faithful brand: native with deltaL 0 → kept at exact lightness", () => {
    expect(
      fillDerivation(brandFill({ native: true, deltaL: 0 }), "light", "light"),
    ).toMatch(/exact lightness/i);
  });

  it("nudged brand: native with deltaL → names the direction it moved, plainly", () => {
    expect(
      fillDerivation(
        brandFill({ native: true, deltaL: -0.06 }),
        "light",
        "light",
      ),
    ).toMatch(/nudged a little darker/i);
    expect(
      fillDerivation(brandFill({ native: true, deltaL: 0.06 }), "dark", "dark"),
    ).toMatch(/nudged a little lighter/i);
  });

  it("off-scheme (scheme ≠ direction): the derived mode-twin wording", () => {
    const sentence = fillDerivation(
      brandFill({ native: false, deltaL: 0.2 }),
      "dark",
      "light",
    );
    expect(sentence).toMatch(/derived version of your color for dark mode/i);
    expect(sentence).toMatch(/really a light-mode color/i);
  });

  it("native-scheme fall-through (native false, scheme = direction): derived WITHOUT the mode claim", () => {
    const sentence = fillDerivation(
      brandFill({ native: false, deltaL: 0.2 }),
      "light",
      "light",
    );
    expect(sentence).toMatch(/derived/i);
    // Must NOT claim the color belongs to another mode — false in this edge.
    expect(sentence).not.toMatch(/-mode color/i);
  });

  it("status fill (seed null): solved at its own fixed canonical hue, names the role", () => {
    const sentence = fillDerivation(
      { kind: "fill", role: "error", hue: 25, seed: null },
      "light",
      "light",
    );
    expect(sentence).toMatch(/fixed error hue/i);
    // A fixed status hue has no brand-seed relationship — never the accent's wording.
    expect(sentence).not.toMatch(/your color/i);
  });
});

describe("fillHoverDerivation — provenance-to-provenance move (#160)", () => {
  it("nudges darker/lighter relative to the RESTING accent, not the seed", () => {
    const hover = fillHoverDerivation(
      brandFill({ native: false, deltaL: 0.1 }),
      brandFill({ native: true, deltaL: 0.0 }),
    );
    // move = 0.1 − 0.0 > 0 → lighter than the resting accent.
    expect(hover).toMatch(/hover state of your accent/i);
    expect(hover).toMatch(/lighter than the resting accent/i);

    const darker = fillHoverDerivation(
      brandFill({ native: false, deltaL: -0.1 }),
      brandFill({ native: true, deltaL: 0.05 }),
    );
    expect(darker).toMatch(/darker than the resting accent/i);
  });

  it("no companion (or no move): falls back to the direction-free line", () => {
    expect(
      fillHoverDerivation(brandFill({ native: false, deltaL: 0.1 }), null),
    ).toMatch(/nudged just enough/i);
    // Equal deltaL → no perceptible move → generic line, never a false direction.
    const noMove = fillHoverDerivation(
      brandFill({ native: false, deltaL: 0.05 }),
      brandFill({ native: true, deltaL: 0.05 }),
    );
    expect(noMove).toMatch(/nudged just enough/i);
    expect(noMove).not.toMatch(/darker|lighter/i);
  });
});

describe("onFillDerivation — pole + chroma (#151/#153), plain", () => {
  it("achromatic (chroma 0): near-white / near-black with headroom", () => {
    const white: OnFillProvenance = {
      kind: "on-fill",
      role: "brand",
      pole: "white",
      hue: 264,
      chroma: 0,
      backedOff: true,
    };
    expect(onFillDerivation(white)).toMatch(/near-white/i);
    expect(onFillDerivation({ ...white, pole: "black" })).toMatch(/near-black/i);
  });

  it("chromatic (chroma > 0): a colorful color-on-color label (#153)", () => {
    const gold: OnFillProvenance = {
      kind: "on-fill",
      role: "brand",
      pole: "white",
      hue: 90,
      chroma: 0.14,
      backedOff: false,
    };
    const sentence = onFillDerivation(gold);
    expect(sentence).toMatch(/colorful label/i);
    expect(sentence).toMatch(/lightness/i);
  });
});

describe("counterpartHint — the other scheme, one line", () => {
  it("step/auto/auto-on: names the other scheme's shade", () => {
    expect(counterpartHint("auto", "light", step("200"))).toBe(
      "In dark mode, this switches to the 200 shade.",
    );
    expect(counterpartHint("step", "dark", step("50"))).toBe(
      "In light mode, this switches to the 50 shade.",
    );
    expect(counterpartHint("auto-on", "light", step("100", "error"))).toBe(
      "In dark mode, this switches to the 100 shade.",
    );
  });

  it("literal: unchanged across modes", () => {
    expect(counterpartHint("literal", "light", { kind: "literal", alpha: 0.5 })).toMatch(
      /in dark mode, this overlay is unchanged/i,
    );
  });

  it("on-fill: names the other scheme's pole", () => {
    expect(
      counterpartHint("on-fill", "light", {
        kind: "on-fill",
        role: "brand",
        pole: "white",
        hue: 0,
        chroma: 0,
        backedOff: true,
      }),
    ).toMatch(/in dark mode, the label leans near-white/i);
  });

  it("brand fill: re-solved for the other background", () => {
    expect(
      counterpartHint("fill", "light", brandFill({ native: false, deltaL: 0.1 })),
    ).toMatch(/in dark mode, your color is re-solved/i);
  });

  it("status fill (seed null): the fill — not 'your color' — is re-solved", () => {
    expect(
      counterpartHint("fill", "light", {
        kind: "fill",
        role: "error",
        hue: 25,
        seed: null,
      }),
    ).toMatch(/in dark mode, this fill is re-solved/i);
  });
});

describe("derivationSentence — dispatch", () => {
  it("routes each kind through its template", () => {
    expect(
      derivationSentence(
        input({
          cardKind: "fill",
          provenance: brandFill({ native: true, deltaL: 0 }),
        }),
      ),
    ).toMatch(/exact lightness/i);
    expect(
      derivationSentence(
        input({
          cardKind: "on-fill",
          provenance: {
            kind: "on-fill",
            role: "brand",
            pole: "black",
            hue: 0,
            chroma: 0,
            backedOff: true,
          },
        }),
      ),
    ).toMatch(/near-black/i);
    // fill-hover reads its companion (the resting accent) through the input.
    expect(
      derivationSentence(
        input({
          cardKind: "fill-hover",
          provenance: brandFill({ native: false, deltaL: 0.1 }),
          companionProvenance: brandFill({ native: true, deltaL: 0 }),
        }),
      ),
    ).toMatch(/hover state of your accent/i);
  });
});

describe("oogNote", () => {
  it("explains the gamut-map-before-contrast ordering in plain words", () => {
    expect(oogNote()).toMatch(/more color than your screen can show/i);
    expect(oogNote()).toMatch(/backwards/i);
  });
});

// The unit tests above feed hand-crafted provenance. This integration sweep runs the REAL
// engine on hostile seeds — where the brand and neutral ramps converge (achromatic), where the
// seed is label-hostile, and the low-chroma light-yellow class — and asserts every one of the
// 34 cards, in BOTH schemes, produces a real sentence and hint. It is the guard against a
// provenance/kind mismatch producing a lying or empty sentence, which synthetic inputs can hide.
describe("derivationSentence — real-engine hostile-seed sweep never lies or empties", () => {
  // The generic branch fallbacks: each signals a provenance that didn't match its card kind. A
  // real palette must never surface one, so seeing any of them is the failure this sweep catches.
  const GENERIC = new Set([
    "A fixed background shade.",
    "Auto-picked to stay readable on the background.",
    "Auto-picked to stay readable on its container.",
    "A signal color, chosen to stand out on the background.",
    "The text that sits on the fill.",
    "A hover state of your accent.",
  ]);

  const HOSTILE = [
    "#faf3c0", // low-chroma light yellow
    "#808080", // achromatic mid grey (brand ≈ neutral)
    "#000000", // pure black
    "#ffffff", // pure white
    "#7f7f00", // dark mid-tone yellow (label-hostile)
    "oklch(0.999 0.2 90)", // extreme L + chroma
    "not-a-color", // engine fallback palette
  ];

  it.each(HOSTILE)("every card sentence is real and specific for %s", (seed) => {
    const palette = derivePalette(seed, DEFAULT_RULES, DEFAULT_GAMUT);
    const cards = buildCards(palette);
    expect(cards).toHaveLength(BRAND_TOKEN_NAMES.length);
    for (const card of cards) {
      for (const facet of [card.light, card.dark]) {
        const where = `${card.name}/${facet.scheme}: "${facet.sentence}"`;
        expect(facet.sentence.trim(), where).not.toBe("");
        expect(facet.sentence.trim().endsWith("."), where).toBe(true);
        expect(GENERIC.has(facet.sentence.trim()), where).toBe(false);
        expect(facet.counterpart.trim(), `${card.name}/${facet.scheme} hint`).not.toBe("");
      }
    }
  });
});
