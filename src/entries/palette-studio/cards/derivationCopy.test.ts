import { describe, expect, it } from "vitest";

import type {
  AccentProvenance,
  OnAccentProvenance,
  RampLabel,
  RampRole,
  StepProvenance,
} from "@garden/oklch";

import {
  accentDerivation,
  counterpartHint,
  derivationSentence,
  formatStep,
  oogNote,
  onAccentDerivation,
  stepOf,
  type DerivationInput,
} from "./derivationCopy";

const step = (
  label: RampLabel,
  role: RampRole = "neutral",
): StepProvenance => ({ kind: "step", role, label });

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
    expect(stepOf({ kind: "accent", native: true, deltaL: 0 })).toBeNull();
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
});

describe("accentDerivation — the co-solve story (#151), plain", () => {
  it("faithful: native with deltaL 0 → kept at exact lightness", () => {
    const prov: AccentProvenance = { kind: "accent", native: true, deltaL: 0 };
    expect(accentDerivation(prov, "light", "light")).toMatch(
      /exact lightness/i,
    );
  });

  it("nudged: native with deltaL → names the direction it moved, plainly", () => {
    expect(
      accentDerivation(
        { kind: "accent", native: true, deltaL: -0.06 },
        "light",
        "light",
      ),
    ).toMatch(/nudged a little darker/i);
    expect(
      accentDerivation(
        { kind: "accent", native: true, deltaL: 0.06 },
        "dark",
        "dark",
      ),
    ).toMatch(/nudged a little lighter/i);
  });

  it("off-scheme (scheme ≠ direction): the derived mode-twin wording", () => {
    const sentence = accentDerivation(
      { kind: "accent", native: false, deltaL: 0.2 },
      "dark",
      "light",
    );
    expect(sentence).toMatch(/derived version of your color for dark mode/i);
    expect(sentence).toMatch(/really a light-mode color/i);
  });

  it("native-scheme fall-through (native false, scheme = direction): derived WITHOUT the mode claim", () => {
    const sentence = accentDerivation(
      { kind: "accent", native: false, deltaL: 0.2 },
      "light",
      "light",
    );
    expect(sentence).toMatch(/derived/i);
    // Must NOT claim the color belongs to another mode — false in this edge.
    expect(sentence).not.toMatch(/-mode color/i);
  });
});

describe("onAccentDerivation — pole + chroma (#151/#153), plain", () => {
  it("achromatic (chroma 0): near-white / near-black with headroom", () => {
    const white: OnAccentProvenance = {
      kind: "on-accent",
      pole: "white",
      hue: 264,
      chroma: 0,
      backedOff: true,
    };
    expect(onAccentDerivation(white)).toMatch(/near-white/i);
    expect(onAccentDerivation({ ...white, pole: "black" })).toMatch(
      /near-black/i,
    );
  });

  it("chromatic (chroma > 0): a colorful color-on-color label (#153)", () => {
    const gold: OnAccentProvenance = {
      kind: "on-accent",
      pole: "white",
      hue: 90,
      chroma: 0.14,
      backedOff: false,
    };
    const sentence = onAccentDerivation(gold);
    expect(sentence).toMatch(/colorful label/i);
    expect(sentence).toMatch(/lightness/i);
  });
});

describe("counterpartHint — the other scheme, one line", () => {
  it("step/auto: names the other scheme's shade", () => {
    expect(counterpartHint("auto", "light", step("200"))).toBe(
      "In dark mode, this switches to the 200 shade.",
    );
    expect(counterpartHint("step", "dark", step("50"))).toBe(
      "In light mode, this switches to the 50 shade.",
    );
  });

  it("on-accent: names the other scheme's pole", () => {
    expect(
      counterpartHint("on-accent", "light", {
        kind: "on-accent",
        pole: "white",
        hue: 0,
        chroma: 0,
        backedOff: true,
      }),
    ).toMatch(/in dark mode, the label leans near-white/i);
  });

  it("accent: re-solved for the other background", () => {
    expect(
      counterpartHint("accent", "light", {
        kind: "accent",
        native: false,
        deltaL: 0.1,
      }),
    ).toMatch(/in dark mode, your color is re-solved/i);
  });
});

describe("derivationSentence — dispatch", () => {
  it("routes each kind through its template", () => {
    expect(
      derivationSentence(
        input({
          cardKind: "accent",
          provenance: { kind: "accent", native: true, deltaL: 0 },
        }),
      ),
    ).toMatch(/exact lightness/i);
    expect(
      derivationSentence(
        input({
          cardKind: "on-accent",
          provenance: {
            kind: "on-accent",
            pole: "black",
            hue: 0,
            chroma: 0,
            backedOff: true,
          },
        }),
      ),
    ).toMatch(/near-black/i);
  });
});

describe("oogNote", () => {
  it("explains the gamut-map-before-contrast ordering in plain words", () => {
    expect(oogNote()).toMatch(/more color than your screen can show/i);
    expect(oogNote()).toMatch(/backwards/i);
  });
});
