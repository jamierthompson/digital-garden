/**
 * Binding-provenance report (#70) — the truthful source for the Studio's "`--text` →
 * `neutral · 800`" receipt.
 *
 * Two obligations proven here:
 *   1. BYTE-IDENTICAL. The report is reporting, not re-solving: every pre-existing output
 *      value (`tokens`, `ramps`, `meta` sans the new field) is bit-for-bit what the engine
 *      baked BEFORE this addition. Proven against a golden fixture generated from the
 *      pre-change engine (`__fixtures__/pre-provenance-tokensets.json`).
 *   2. TRUTHFUL. The report names the binding SCHEMA's role — not whatever a value-scan
 *      across the ramps would find. In the reachable states where the brand and neutral
 *      ramps CONVERGE (an achromatic seed with `tintedNeutrals: false` collapses both to the
 *      same pinned grey steps), a first-match value-scan mislabels a neutral-bound token as
 *      `brand`; the report does not.
 */

import { describe, expect, it } from "vitest";

import goldenFixture from "./__fixtures__/pre-provenance-tokensets.json";
import { buildTokenSet } from "./palette";
import {
  BRAND_TOKEN_NAMES,
  RAMP_ROLES,
  type BindingProvenance,
  type BrandTokenName,
  type EngineRules,
  type OkLCH,
  type Ramp,
  type RampRole,
  type Scheme,
  type TokenSet,
} from "./types";

// The same cases the golden fixture was generated from (keep in lock-step).
const CASES: Array<{
  key: string;
  seed: unknown;
  opts: Record<string, unknown>;
}> = [
  { key: "blue", seed: "#3b82f6", opts: {} },
  { key: "violet", seed: "#7c3aed", opts: {} },
  { key: "crimson", seed: "#e11d48", opts: {} },
  { key: "too-light", seed: "#faf3c0", opts: {} },
  { key: "achromatic", seed: "#808080", opts: {} },
  { key: "achromatic-p3", seed: "#808080", opts: { gamut: "p3" } },
  {
    key: "untinted-neutrals",
    seed: "#3b82f6",
    opts: { rules: { tintedNeutrals: false } },
  },
  { key: "fallback", seed: "garbage", opts: {} },
];

const golden = goldenFixture as Record<string, unknown>;

/** The pre-existing surface of a TokenSet — everything EXCEPT the added `meta.bindings`. */
function withoutBindings(set: TokenSet): unknown {
  const meta: Record<string, unknown> = { ...set.meta };
  delete meta.bindings;
  return { tokens: set.tokens, ramps: set.ramps, meta };
}

const SCHEMES: Scheme[] = ["light", "dark"];
const sameColor = (a: OkLCH, b: OkLCH): boolean =>
  a.L === b.L && a.C === b.C && a.H === b.H;

// The documented default schema's role per ramp-bound token (accent/on-accent excluded —
// they are the continuous co-solve). Mirrors palette.ts DEFAULT_SCHEMA.
const EXPECTED_ROLE: Partial<Record<BrandTokenName, RampRole>> = {
  bg: "neutral",
  surface: "neutral",
  "surface-2": "neutral",
  text: "neutral",
  "text-muted": "neutral",
  border: "neutral",
  "accent-text": "brand",
  "focus-ring": "brand",
  success: "success",
  error: "error",
  warning: "warning",
  info: "info",
};

const CONTINUOUS: BrandTokenName[] = ["accent", "on-accent"];

describe("byte-identical (#70): the report never perturbs a baked value", () => {
  it.each(CASES)(
    "$key — tokens/ramps/meta match the pre-change engine bit-for-bit",
    ({ key, seed, opts }) => {
      const set = buildTokenSet(seed, opts);
      expect(withoutBindings(set)).toEqual(golden[key]);
    },
  );

  it("the golden fixture predates the field (guards the proof itself)", () => {
    // If the fixture ever carried `meta.bindings`, the byte-identical check above would be
    // vacuous. Prove the reference truly lacks the new field.
    for (const key of Object.keys(golden)) {
      const ref = golden[key] as { meta: Record<string, unknown> };
      expect(ref.meta).not.toHaveProperty("bindings");
    }
  });
});

describe("truthful provenance (#70): reports the schema role, not a value-scan", () => {
  // The states the task calls out: achromatic seed and/or pure achromatic neutrals — where
  // the brand and neutral ramps numerically converge at their pinned shoulder steps.
  const TRIGGERS: Array<{ label: string; seed: string; rules?: EngineRules }> =
    [
      { label: "achromatic seed, default tint", seed: "#808080" },
      {
        label: "achromatic seed, tintedNeutrals:false",
        seed: "#808080",
        rules: { tintedNeutrals: false },
      },
      {
        label: "chromatic seed, tintedNeutrals:false",
        seed: "#3b82f6",
        rules: { tintedNeutrals: false },
      },
    ];

  it.each(TRIGGERS)(
    "$label — every ramp-bound token reports its SCHEMA role",
    ({ seed, rules }) => {
      const set = buildTokenSet(seed, rules ? { rules } : {});
      for (const scheme of SCHEMES) {
        for (const [name, role] of Object.entries(EXPECTED_ROLE) as [
          BrandTokenName,
          RampRole,
        ][]) {
          const binding = set.meta.bindings[name][scheme];
          expect(binding, `${name}/${scheme}`).not.toBeNull();
          expect(binding!.role, `${name}/${scheme}`).toBe(role);
        }
      }
    },
  );

  it.each(TRIGGERS)(
    "$label — accent + on-accent report null (continuous co-solve, no discrete step)",
    ({ seed, rules }) => {
      const set = buildTokenSet(seed, rules ? { rules } : {});
      for (const scheme of SCHEMES)
        for (const name of CONTINUOUS)
          expect(
            set.meta.bindings[name][scheme],
            `${name}/${scheme}`,
          ).toBeNull();
    },
  );

  it.each(TRIGGERS)(
    "$label — internal consistency: every reported step's color IS the token value",
    ({ seed, rules }) => {
      const set = buildTokenSet(seed, rules ? { rules } : {});
      for (const scheme of SCHEMES) {
        const rampFor = (role: RampRole): Ramp => set.ramps[role][scheme];
        for (const name of BRAND_TOKEN_NAMES) {
          const binding = set.meta.bindings[name][scheme];
          if (binding === null) continue; // continuous / literal — no step to check
          const step = rampFor(binding.role).find(
            (s) => s.label === binding.label,
          );
          expect(
            step,
            `${name}/${scheme} step ${binding.role}·${binding.label}`,
          ).toBeDefined();
          expect(
            sameColor(step!.color, set.tokens[name][scheme]),
            `${name}/${scheme}: reported ${binding.role}·${binding.label} must equal the baked value`,
          ).toBe(true);
        }
      }
    },
  );

  // The whole point of solving-at-source. Where the brand and neutral ramps CONVERGE, the
  // deleted `findBoundStep` heuristic (first ramp in RAMP_ROLES order carrying a step whose
  // color equals the value) picks the role by SCAN ORDER, not by the schema. The bend
  // preserves the ramp endpoints exactly, so for pure black + `tintedNeutrals: false` the
  // grey `brand[50]` and `neutral[50]` are bit-identical — and `bg` binds that endpoint.
  it("beats the value-scan where brand ≡ neutral at an endpoint (#000000, untinted)", () => {
    const set = buildTokenSet("#000000", { rules: { tintedNeutrals: false } });
    const scheme: Scheme = "light";

    const bg = set.tokens.bg[scheme];
    const brand50 = set.ramps.brand[scheme][0];
    const neutral50 = set.ramps.neutral[scheme][0];
    // The coincidence the value-scan cannot disambiguate: bg's baked value is BOTH
    // brand[50] and neutral[50], to the last bit (guarded so the demonstrator can't rot
    // silently — if the ramp math stops converging here, this precondition fails loudly).
    expect(brand50.label).toBe("50");
    expect(sameColor(bg, neutral50.color)).toBe(true);
    expect(sameColor(bg, brand50.color)).toBe(true);

    // The old heuristic: FIRST role (brand precedes neutral) with a matching step wins.
    const firstMatch = (value: OkLCH): BindingProvenance => {
      for (const role of RAMP_ROLES)
        for (const step of set.ramps[role][scheme])
          if (sameColor(step.color, value)) return { role, label: step.label };
      return null;
    };

    // The value-scan is FOOLED — it names `brand`, a false receipt.
    expect(firstMatch(bg)).toEqual({ role: "brand", label: "50" });
    // The engine report is TRUTHFUL — bg binds the NEUTRAL ramp, per the schema.
    expect(set.meta.bindings.bg[scheme]).toEqual({
      role: "neutral",
      label: "50",
    });
  });
});
