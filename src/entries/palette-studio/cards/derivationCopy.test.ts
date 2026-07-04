import { describe, expect, it } from "vitest";

import type { BindingStep, ContrastCheck } from "@garden/oklch";

import {
  derivationSentence,
  formatStep,
  oogNote,
  type DerivationInput,
} from "./derivationCopy";

const MEASURED: ContrastCheck = { wcag: 9.3, apca: 84, passes: true };

/** A complete `DerivationInput` with sensible defaults; override per case. */
function input(overrides: Partial<DerivationInput>): DerivationInput {
  return {
    kind: "auto",
    scheme: "light",
    boundStep: null,
    otherStep: null,
    measured: null,
    targetPhrase: null,
    direction: "light",
    accentFidelity: "faithful",
    onAccentPole: "near-white",
    ...overrides,
  };
}

const step = (
  label: BindingStep["label"],
  role: BindingStep["role"] = "neutral",
): BindingStep => ({
  role,
  label,
});

describe("formatStep", () => {
  it("prints a (role, label) as 'role · label'", () => {
    expect(formatStep(step("800"))).toBe("neutral · 800");
    expect(formatStep(step("500", "brand"))).toBe("brand · 500");
  });
});

describe("derivationSentence — step", () => {
  it("names the pinned step and the other scheme's flip", () => {
    const sentence = derivationSentence(
      input({
        kind: "step",
        scheme: "light",
        boundStep: step("100"),
        otherStep: step("900"),
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
        kind: "auto",
        boundStep: step("800"),
        measured: MEASURED,
        targetPhrase: "4.5:1 and Lc 75",
      }),
    );
    expect(sentence).toContain("Bound to neutral · 800");
    expect(sentence).toContain("clears 4.5:1 and Lc 75");
    expect(sentence).toContain("Measured: 9.3:1 · Lc 84");
  });
});

describe("derivationSentence — accent (the #151 seam)", () => {
  it("faithful: kept at the seed's exact lightness", () => {
    const sentence = derivationSentence(
      input({ kind: "accent", direction: "light", accentFidelity: "faithful" }),
    );
    expect(sentence).toMatch(/exact lightness/i);
  });

  it("nudged: moved the minimum needed for a legible label", () => {
    const sentence = derivationSentence(
      input({ kind: "accent", direction: "light", accentFidelity: "nudged" }),
    );
    expect(sentence).toMatch(/nudged/i);
  });

  it("derived: off the native scheme, describes the derived twin", () => {
    const sentence = derivationSentence(
      input({
        kind: "accent",
        scheme: "dark",
        direction: "light",
        accentFidelity: "derived",
      }),
    );
    expect(sentence).toMatch(/light-mode color/i);
    expect(sentence).toMatch(/derived dark-mode twin/i);
  });
});

describe("derivationSentence — on-accent", () => {
  it("names the winning extreme and the headroom", () => {
    expect(
      derivationSentence(
        input({ kind: "on-accent", onAccentPole: "near-white" }),
      ),
    ).toMatch(/near-white/i);
    expect(
      derivationSentence(
        input({ kind: "on-accent", onAccentPole: "near-black" }),
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
