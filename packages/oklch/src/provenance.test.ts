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
  type OnAccentProvenance,
  type Ramp,
  type RampRole,
  type Scheme,
  type StepProvenance,
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

/**
 * The pre-change surface of a TokenSet, minus the two intentional post-fixture changes:
 * `meta.bindings` (added by the #70/#151 provenance report) and the `on-accent` token (moved
 * by #153's chromatic label for chromatic seeds). Everything that REMAINS — the accent FILL,
 * all six ramps, the surfaces, every other token, and the rest of `meta` — must still be
 * bit-identical to the pre-change engine. Applied to both the live set and the golden JSON.
 */
function stableSurface(view: unknown): unknown {
  const v = view as {
    tokens: Record<string, unknown>;
    ramps: unknown;
    meta: Record<string, unknown>;
  };
  const meta = { ...v.meta };
  delete meta.bindings; // #70 / #151 — reported provenance, not a baked value
  const tokens = { ...v.tokens };
  delete tokens["on-accent"]; // #153 — the chromatic label legitimately moved
  return { tokens, ramps: v.ramps, meta };
}

/** The cases whose seed is achromatic — where #153 degrades to today's white/black label, so
 *  even `on-accent` stays bit-identical (the C→0 limit / strict-generalization guarantee). */
const ACHROMATIC_KEYS = new Set(["achromatic", "achromatic-p3"]);

const SCHEMES: Scheme[] = ["light", "dark"];
const sameColor = (a: OkLCH, b: OkLCH): boolean =>
  a.L === b.L && a.C === b.C && a.H === b.H;

// The documented default schema's role per ramp-bound token (accent/on-accent excluded —
// they are the continuous co-solve). Mirrors palette.ts DEFAULT_BINDING_SCHEMA.
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

describe("byte-identical (#70, #153): only the report + the #153 label ever move", () => {
  it.each(CASES)(
    "$key — the fill, ramps, surfaces, other tokens + meta match the pre-change engine bit-for-bit",
    ({ key, seed, opts }) => {
      const set = buildTokenSet(seed, opts);
      // The provenance report (#70/#151) and the #153 on-accent label are the ONLY intended
      // changes; everything else is proven unchanged against the pre-change golden fixture.
      expect(stableSurface(set)).toEqual(stableSurface(golden[key]));
    },
  );

  it.each(CASES.filter((c) => ACHROMATIC_KEYS.has(c.key)))(
    "$key — on-accent is ALSO bit-identical (achromatic seed = #153's C→0 limit)",
    ({ key, seed, opts }) => {
      // Strict generalization: an achromatic seed has no chroma to spend, so #153's label is
      // the same near-white/near-black extreme as before — the on-accent token cannot move.
      const set = buildTokenSet(seed, opts);
      const ref = golden[key] as { tokens: Record<string, unknown> };
      expect(set.tokens["on-accent"]).toEqual(ref.tokens["on-accent"]);
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
          expect(binding?.kind, `${name}/${scheme}`).toBe("step");
          expect((binding as StepProvenance).role, `${name}/${scheme}`).toBe(
            role,
          );
        }
      }
    },
  );

  it.each(TRIGGERS)(
    "$label — accent + on-accent carry a co-solve report, never null (#151)",
    ({ seed, rules }) => {
      const set = buildTokenSet(seed, rules ? { rules } : {});
      for (const scheme of SCHEMES)
        for (const name of CONTINUOUS) {
          const p = set.meta.bindings[name][scheme];
          expect(p, `${name}/${scheme}`).not.toBeNull();
          // The report's kind matches the token: `accent` → "accent", `on-accent` → "on-accent".
          expect(p!.kind, `${name}/${scheme}`).toBe(name);
        }
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
          if (binding?.kind !== "step") continue; // co-solve / literal — no ramp step
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
          if (sameColor(step.color, value))
            return { kind: "step", role, label: step.label };
      return null;
    };

    // The value-scan is FOOLED — it names `brand`, a false receipt.
    expect(firstMatch(bg)).toEqual({
      kind: "step",
      role: "brand",
      label: "50",
    });
    // The engine report is TRUTHFUL — bg binds the NEUTRAL ramp, per the schema.
    expect(set.meta.bindings.bg[scheme]).toEqual({
      kind: "step",
      role: "neutral",
      label: "50",
    });
  });
});

// #151 — the accent/on-accent bindings stop being `null` and carry a first-class co-solve
// report, so the Studio renders faithful/nudged/derived + the label pole WITHOUT comparing
// `meta.seed` to `tokens.accent` (exactly the value-matching #109 forbids). The reports are
// REPORTING ONLY — the byte-identical suite above (which strips `meta.bindings`) already
// proves no baked value moved; here we prove the reports are truthful to those values.
describe("accent + on-accent co-solve report (#151)", () => {
  const REPORT_CASES = [
    "#3b82f6", // chromatic, light-native
    "#e11d48", // chromatic
    "#faf3c0", // very light — dark-native
    "#808080", // achromatic
    "garbage", // fallback (chromatic fallback seed)
  ];

  it.each(REPORT_CASES)(
    "%s — every field is internally consistent with the baked colors (no lie)",
    (seed) => {
      const set = buildTokenSet(seed);
      for (const scheme of SCHEMES) {
        const accent = set.tokens.accent[scheme];
        const onAccent = set.tokens["on-accent"][scheme];
        const s = set.meta.seed[scheme];

        const accentP = set.meta.bindings.accent[scheme];
        if (accentP?.kind !== "accent")
          throw new Error(`accent/${scheme}: expected accent report`);
        // `native` is the faithful-path flag — true iff the fill came from the native solve.
        // For every seed here that solve succeeds when this scheme is the seed's direction,
        // so it equals `scheme === direction`. `deltaL` is exactly the fill's L delta off the
        // seed — both recoverable without any value-scan of the ramps.
        expect(accentP.native).toBe(scheme === set.meta.direction);
        expect(accentP.deltaL).toBe(accent.L - s.L);

        const labelP = set.meta.bindings["on-accent"][scheme];
        if (labelP?.kind !== "on-accent")
          throw new Error(`on-accent/${scheme}: expected on-accent report`);
        expect(labelP.hue).toBe(s.H);
        expect(labelP.chroma).toBe(onAccent.C);
        expect(labelP.pole).toBe(onAccent.L >= accent.L ? "white" : "black");
      }
    },
  );

  // For genuinely hostable seeds the faithful native solve succeeds in the seed's own
  // direction, so `native` flags exactly that scheme — the accent's faithful/derived story
  // with no value math. (On the rare native seed with no hostable label the fill is derived
  // and `native` is false; none of these seeds hit that path.)
  it("flags exactly the native scheme — the accent's faithful/derived story, no value math", () => {
    for (const seed of REPORT_CASES) {
      const set = buildTokenSet(seed);
      const nativeFlags = SCHEMES.map((scheme) => {
        const p = set.meta.bindings.accent[scheme];
        return p?.kind === "accent" ? p.native : null;
      });
      expect(nativeFlags, seed).toEqual(
        SCHEMES.map((scheme) => scheme === set.meta.direction),
      );
    }
  });

  it("a chromatic seed's on-accent report tracks the #153 chromatic label (chroma is the label's own)", () => {
    const set = buildTokenSet("#3b82f6");
    // Navy fill in dark mode hosts a chromatic light label — the report carries its REAL
    // chroma (not 0), exactly the baked token's, with backedOff = carries less than the seed's.
    const p = set.meta.bindings["on-accent"].dark;
    if (p?.kind !== "on-accent") throw new Error("expected on-accent report");
    expect(p.chroma).toBeGreaterThan(0.03);
    expect(p.chroma).toBe(set.tokens["on-accent"].dark.C);
    expect(p.backedOff).toBe(p.chroma + 1e-4 < set.meta.seed.dark.C);
  });

  it("an achromatic seed's on-accent reports backedOff false (no chroma to give up)", () => {
    const set = buildTokenSet("#808080");
    for (const scheme of SCHEMES) {
      const p = set.meta.bindings["on-accent"][scheme];
      if (p?.kind !== "on-accent") throw new Error("expected on-accent report");
      expect(p.backedOff).toBe(false);
    }
  });
});
