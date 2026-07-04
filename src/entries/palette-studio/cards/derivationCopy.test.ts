import { describe, expect, it } from "vitest";

import type {
  AccentProvenance,
  ContrastCheck,
  OnAccentProvenance,
  RampLabel,
  RampRole,
  StepProvenance,
} from "@garden/oklch";

import {
  accentDerivation,
  derivationSentence,
  formatStep,
  oogNote,
  onAccentDerivation,
  stepOf,
  type DerivationInput,
} from "./derivationCopy";

const MEASURED: ContrastCheck = { wcag: 9.3, apca: 84, passes: true };

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
    otherProvenance: null,
    measured: null,
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

describe("derivationSentence — step", () => {
  it("names the pinned step and the other scheme's flip", () => {
    const sentence = derivationSentence(
      input({
        cardKind: "step",
        scheme: "light",
        provenance: step("100"),
        otherProvenance: step("900"),
      }),
    );
    expect(sentence).toContain("Pinned to neutral · 100");
    expect(sentence).toContain(
      "dark-scheme counterpart flips to neutral · 900",
    );
  });
});

describe("derivationSentence — auto", () => {
  it("names the bound step, the target, and the live measurement", () => {
    const sentence = derivationSentence(
      input({
        cardKind: "auto",
        provenance: step("800"),
        measured: MEASURED,
        targetPhrase: "4.5:1 and Lc 75",
      }),
    );
    expect(sentence).toContain("Bound to neutral · 800");
    expect(sentence).toContain("clears 4.5:1 and Lc 75");
    expect(sentence).toContain("Measured: 9.3:1 · Lc 84");
  });
});

describe("accentDerivation — the co-solve story (#151)", () => {
  it("faithful: native with deltaL 0 → kept at exact lightness", () => {
    const prov: AccentProvenance = { kind: "accent", native: true, deltaL: 0 };
    expect(accentDerivation(prov, "light", "light")).toMatch(
      /exact lightness/i,
    );
  });

  it("nudged: native with deltaL → names the direction it moved", () => {
    expect(
      accentDerivation(
        { kind: "accent", native: true, deltaL: -0.06 },
        "light",
        "light",
      ),
    ).toMatch(/nudged darker/i);
    expect(
      accentDerivation(
        { kind: "accent", native: true, deltaL: 0.06 },
        "dark",
        "dark",
      ),
    ).toMatch(/nudged lighter/i);
  });

  it("off-scheme (scheme ≠ direction): the derived mode-twin headline", () => {
    const prov: AccentProvenance = {
      kind: "accent",
      native: false,
      deltaL: 0.2,
    };
    const sentence = accentDerivation(prov, "dark", "light");
    expect(sentence).toMatch(/your seed is a light-mode color/i);
    expect(sentence).toMatch(/derived dark-mode twin/i);
  });

  it("native-scheme fall-through (native false, scheme = direction): derived WITHOUT the mode-twin claim", () => {
    // The edge the reviewer flagged: a native-direction seed whose faithful solve finds no
    // hostable label falls to the derived scan → native:false in its OWN native scheme.
    const prov: AccentProvenance = {
      kind: "accent",
      native: false,
      deltaL: 0.2,
    };
    const sentence = accentDerivation(prov, "light", "light");
    expect(sentence).toMatch(/derived/i);
    // Must NOT claim the seed is an other-mode color — that would be false here.
    expect(sentence).not.toMatch(/-mode color/i);
    expect(sentence).not.toMatch(/-mode twin/i);
  });
});

describe("onAccentDerivation — pole + chroma (#151/#153)", () => {
  it("achromatic (chroma 0): names the near-white/near-black extreme + headroom", () => {
    const white: OnAccentProvenance = {
      kind: "on-accent",
      pole: "white",
      hue: 264,
      chroma: 0,
      backedOff: true,
    };
    expect(onAccentDerivation(white, MEASURED)).toMatch(/near-white/i);
    expect(onAccentDerivation({ ...white, pole: "black" }, MEASURED)).toMatch(
      /near-black/i,
    );
    expect(onAccentDerivation(white, MEASURED)).toContain(
      "Measured: 9.3:1 · Lc 84",
    );
  });

  it("chromatic (chroma > 0): describes the color-on-color label (#153)", () => {
    const gold: OnAccentProvenance = {
      kind: "on-accent",
      pole: "white",
      hue: 90,
      chroma: 0.14,
      backedOff: false,
    };
    const sentence = onAccentDerivation(gold, MEASURED);
    expect(sentence).toMatch(/saturated label/i);
    expect(sentence).toMatch(/lightness contrast/i);
    // A light-pole chromatic label reads as a light saturated color.
    expect(sentence).toMatch(/\blight\b/i);
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
  it("explains the gamut-map-before-contrast ordering", () => {
    expect(oogNote()).toMatch(/desaturated/i);
    expect(oogNote()).toMatch(/backwards/i);
  });
});
