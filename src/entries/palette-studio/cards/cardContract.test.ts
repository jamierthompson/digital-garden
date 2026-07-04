import { describe, expect, it } from "vitest";

import { BRAND_TOKEN_NAMES } from "@garden/oklch";

import { CARD_CONTRACT, describeTarget } from "./cardContract";

describe("CARD_CONTRACT", () => {
  it("covers every one of the 14 semantic tokens", () => {
    for (const name of BRAND_TOKEN_NAMES) {
      expect(CARD_CONTRACT[name]).toBeDefined();
    }
    expect(Object.keys(CARD_CONTRACT)).toHaveLength(BRAND_TOKEN_NAMES.length);
  });

  it("classifies the four binding kinds the way the engine schema does", () => {
    // Surfaces are pinned steps.
    expect(CARD_CONTRACT.bg.kind).toBe("step");
    expect(CARD_CONTRACT.surface.kind).toBe("step");
    expect(CARD_CONTRACT["surface-2"].kind).toBe("step");
    // The accent fill and its label are the continuous co-solves.
    expect(CARD_CONTRACT.accent.kind).toBe("accent");
    expect(CARD_CONTRACT["on-accent"].kind).toBe("on-accent");
    // Everything readable-on-surface is an `auto` (minPass) solve.
    for (const name of [
      "text",
      "text-muted",
      "border",
      "accent-text",
      "focus-ring",
      "success",
      "error",
      "warning",
      "info",
    ] as const) {
      expect(CARD_CONTRACT[name].kind).toBe("auto");
    }
  });

  it("measures foregrounds against surface-2, on-accent against the accent fill, surfaces against nothing", () => {
    // Surfaces are canvases — no contrast pair.
    expect(CARD_CONTRACT.bg.against).toBeNull();
    expect(CARD_CONTRACT.surface.against).toBeNull();
    expect(CARD_CONTRACT["surface-2"].against).toBeNull();
    // Readable tokens solve on the worst-case surface.
    expect(CARD_CONTRACT.text.against?.bg).toBe("surface-2");
    // The label is measured on the fill it sits on.
    expect(CARD_CONTRACT["on-accent"].against?.bg).toBe("accent");
  });

  it("mirrors the engine's per-token targets exactly (the #150 seam)", () => {
    expect(CARD_CONTRACT.text.against?.target).toEqual({ wcag: 4.5, apca: 75 });
    expect(CARD_CONTRACT["text-muted"].against?.target).toEqual({
      wcag: 4.5,
      apca: 60,
    });
    expect(CARD_CONTRACT.border.against?.target).toEqual({ wcag: 3, apca: 30 });
    expect(CARD_CONTRACT.accent.against?.target).toEqual({ wcag: 3, apca: 45 });
    expect(CARD_CONTRACT["on-accent"].against?.target).toEqual({
      wcag: 4.5,
      apca: 60,
    });
  });

  it("names the ramp role for stepped/auto tokens and null for the co-solves", () => {
    expect(CARD_CONTRACT.text.role).toBe("neutral");
    expect(CARD_CONTRACT["accent-text"].role).toBe("brand");
    expect(CARD_CONTRACT.error.role).toBe("error");
    expect(CARD_CONTRACT.accent.role).toBeNull();
    expect(CARD_CONTRACT["on-accent"].role).toBeNull();
  });
});

describe("describeTarget", () => {
  it("prints an integer ratio without decimals and a fractional one with", () => {
    expect(describeTarget({ wcag: 4.5, apca: 75 })).toBe("4.5:1 and Lc 75");
    expect(describeTarget({ wcag: 3, apca: 45 })).toBe("3:1 and Lc 45");
  });
});
