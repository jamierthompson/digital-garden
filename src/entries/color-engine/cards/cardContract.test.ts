import { describe, expect, it } from "vitest";

import { BRAND_TOKEN_NAMES } from "@garden/oklch";

import { CARD_CONTRACT, describeTarget } from "./cardContract";

describe("CARD_CONTRACT", () => {
  it("covers every semantic token (the full 34-token contract)", () => {
    for (const name of BRAND_TOKEN_NAMES) {
      expect(CARD_CONTRACT[name]).toBeDefined();
    }
    expect(Object.keys(CARD_CONTRACT)).toHaveLength(BRAND_TOKEN_NAMES.length);
  });

  it("classifies the seven binding kinds the way the engine schema does", () => {
    // Surfaces + containers are pinned steps.
    expect(CARD_CONTRACT.bg.kind).toBe("step");
    expect(CARD_CONTRACT["surface-2"].kind).toBe("step");
    expect(CARD_CONTRACT["surface-hover"].kind).toBe("step");
    expect(CARD_CONTRACT["surface-selected"].kind).toBe("step");
    expect(CARD_CONTRACT["error-container"].kind).toBe("step");
    // The brand accent and the status signals are co-solved fills.
    expect(CARD_CONTRACT.accent.kind).toBe("fill");
    for (const name of ["error", "warning", "success", "info"] as const) {
      expect(CARD_CONTRACT[name].kind).toBe("fill");
    }
    // Each fill's label is an on-fill co-solve.
    expect(CARD_CONTRACT["on-accent"].kind).toBe("on-fill");
    expect(CARD_CONTRACT["on-error"].kind).toBe("on-fill");
    // accent-hover is the interaction-state fill.
    expect(CARD_CONTRACT["accent-hover"].kind).toBe("fill-hover");
    // A container label is solved against its container (auto-on).
    expect(CARD_CONTRACT["on-error-container"].kind).toBe("auto-on");
    // The scrim overlay is the lone literal.
    expect(CARD_CONTRACT.scrim.kind).toBe("literal");
    // Everything readable-on-surface is an `auto` (minPass) solve.
    for (const name of [
      "text",
      "text-muted",
      "border",
      "accent-text",
      "focus-ring",
      "error-text",
      "warning-text",
      "success-text",
      "info-text",
    ] as const) {
      expect(CARD_CONTRACT[name].kind).toBe("auto");
    }
  });

  it("measures foregrounds against surface-selected, labels against their fill/container, surfaces against nothing", () => {
    // Surfaces + containers + the literal are canvases — no contrast pair.
    expect(CARD_CONTRACT.bg.against).toBeNull();
    expect(CARD_CONTRACT["surface-2"].against).toBeNull();
    expect(CARD_CONTRACT["surface-selected"].against).toBeNull();
    expect(CARD_CONTRACT["error-container"].against).toBeNull();
    expect(CARD_CONTRACT.scrim.against).toBeNull();
    // Readable tokens solve on the worst-case surface — the darkest text-bearing one.
    expect(CARD_CONTRACT.text.against?.bg).toBe("surface-selected");
    expect(CARD_CONTRACT.accent.against?.bg).toBe("surface-selected");
    // A fill's label is measured on the fill it sits on.
    expect(CARD_CONTRACT["on-accent"].against?.bg).toBe("accent");
    expect(CARD_CONTRACT["on-error"].against?.bg).toBe("error");
    // A container's label is measured on its container.
    expect(CARD_CONTRACT["on-error-container"].against?.bg).toBe(
      "error-container",
    );
  });

  it("mirrors the engine's per-token targets exactly (the #150 seam)", () => {
    expect(CARD_CONTRACT.text.against?.target).toEqual({ wcag: 4.5, apca: 75 });
    expect(CARD_CONTRACT["text-muted"].against?.target).toEqual({
      wcag: 4.5,
      apca: 60,
    });
    expect(CARD_CONTRACT.border.against?.target).toEqual({ wcag: 3, apca: 30 });
    // A fill lands the UI floor; accent-hover shares it.
    expect(CARD_CONTRACT.accent.against?.target).toEqual({ wcag: 3, apca: 45 });
    expect(CARD_CONTRACT["accent-hover"].against?.target).toEqual({
      wcag: 3,
      apca: 45,
    });
    // A label lands the onAccent tier.
    expect(CARD_CONTRACT["on-accent"].against?.target).toEqual({
      wcag: 4.5,
      apca: 60,
    });
    // A container label reads the schema's own auto-on target.
    expect(CARD_CONTRACT["on-error-container"].against?.target).toEqual({
      wcag: 4.5,
      apca: 60,
    });
  });

  it("names the ramp role for stepped/auto tokens and null for the co-solves + literal", () => {
    expect(CARD_CONTRACT.text.role).toBe("neutral");
    expect(CARD_CONTRACT["accent-text"].role).toBe("brand");
    expect(CARD_CONTRACT.error.role).toBeNull(); // a fill — carries a role for identity, no mini-ramp
    expect(CARD_CONTRACT["error-container"].role).toBe("error"); // a step — real ramp position
    expect(CARD_CONTRACT.accent.role).toBeNull();
    expect(CARD_CONTRACT["on-accent"].role).toBeNull();
    expect(CARD_CONTRACT.scrim.role).toBeNull();
  });
});

describe("describeTarget", () => {
  it("prints an integer ratio without decimals and a fractional one with", () => {
    expect(describeTarget({ wcag: 4.5, apca: 75 })).toBe("4.5:1 and Lc 75");
    expect(describeTarget({ wcag: 3, apca: 45 })).toBe("3:1 and Lc 45");
  });
});
