import { describe, expect, it } from "vitest";

import { BRAND_TOKEN_NAMES } from "@garden/oklch";

import { derivePalette } from "../core/derive";
import { DEFAULT_RULES } from "../core/rules";
import { buildCards } from "./cardModel";

const SEED = "#7c3aed"; // a saturated violet — light-native, exercises every kind
const cards = buildCards(derivePalette(SEED, DEFAULT_RULES, "srgb"));
const byName = (name: string) => {
  const card = cards.find((c) => c.name === name);
  if (!card) throw new Error(`no card for ${name}`);
  return card;
};

describe("buildCards", () => {
  it("returns one card per token, in canonical emission order", () => {
    expect(cards).toHaveLength(BRAND_TOKEN_NAMES.length);
    expect(cards.map((c) => c.name)).toEqual([...BRAND_TOKEN_NAMES]);
  });

  it("carries both scheme facets with formatted oklch + hex values", () => {
    const text = byName("text");
    for (const facet of [text.light, text.dark]) {
      expect(facet.oklch.startsWith("oklch(")).toBe(true);
      expect(facet.hex.startsWith("#")).toBe(true);
    }
    expect(text.light.scheme).toBe("light");
    expect(text.dark.scheme).toBe("dark");
  });

  it("binds an auto token to a real ramp step and re-measures it passing", () => {
    const text = byName("text");
    expect(text.kind).toBe("auto");
    expect(text.light.boundStep?.role).toBe("neutral");
    expect(text.light.ramp).toHaveLength(11);
    // The live re-measurement of the baked literal must clear the target (engine guarantee).
    expect(text.light.measured?.passes).toBe(true);
    expect(text.dark.measured?.passes).toBe(true);
  });

  it("leaves surface cards without a contrast measurement (they are canvases)", () => {
    const bg = byName("bg");
    expect(bg.kind).toBe("step");
    expect(bg.light.measured).toBeNull();
    // …but a surface still has a ramp position (its pinned step).
    expect(bg.light.boundStep?.role).toBe("neutral");
    expect(bg.light.ramp).toHaveLength(11);
  });

  it("gives the accent co-solve no bound step and no ramp, but a real measurement", () => {
    const accent = byName("accent");
    expect(accent.kind).toBe("accent");
    expect(accent.light.boundStep).toBeNull();
    expect(accent.light.ramp).toBeNull();
    // The fill is still measured against the worst-case surface (UI floor).
    expect(accent.light.measured?.passes).toBe(true);
  });

  it("measures on-accent against the accent fill", () => {
    const onAccent = byName("on-accent");
    expect(onAccent.kind).toBe("on-accent");
    expect(onAccent.light.boundStep).toBeNull();
    expect(onAccent.light.measured?.passes).toBe(true);
  });

  it("regenerates the derivation copy from the seed's provenance per scheme", () => {
    // #7c3aed is light-native, so light is faithful/nudged and dark is the derived twin.
    const accent = byName("accent");
    expect(accent.light.sentence).not.toMatch(/derived version of your color/i);
    expect(accent.dark.sentence).toMatch(
      /derived version of your color for dark mode/i,
    );
  });

  it("carries a one-line counterpart hint pointing at the other scheme", () => {
    const text = byName("text");
    // The light face's hint names the DARK shade, and vice versa.
    expect(text.light.counterpart).toMatch(
      /in dark mode, this switches to the/i,
    );
    expect(text.dark.counterpart).toMatch(
      /in light mode, this switches to the/i,
    );
    // The accent's hint is the re-solve line, not a shade.
    expect(byName("accent").light.counterpart).toMatch(/re-solved/i);
  });
});
