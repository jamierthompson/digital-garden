/**
 * Binding-provenance report (#70) — the truthful source for the Studio's "`--text` →
 * `neutral · 800`" receipt.
 *
 * Two obligations proven here:
 *   1. DETERMINISTIC SNAPSHOT. The full `buildTokenSet` output (every token, ramp, and the
 *      `meta.bindings` receipt) is bit-for-bit stable — pinned against a committed golden
 *      snapshot (`__fixtures__/tokenset-golden.json`, regenerated wholesale with the 34-token
 *      contract, #160). Any accidental value drift in a future change fails here.
 *   2. TRUTHFUL. The report names the binding SCHEMA's role — not whatever a value-scan
 *      across the ramps would find. In the reachable states where the brand and neutral
 *      ramps CONVERGE (an achromatic seed with `tintedNeutrals: false` collapses both to the
 *      same pinned grey steps), a first-match value-scan mislabels a neutral-bound token as
 *      `brand`; the report does not.
 */

import { describe, expect, it } from "vitest";

import goldenFixture from "./__fixtures__/tokenset-golden.json";
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
  type StepProvenance,
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

const SCHEMES: Scheme[] = ["light", "dark"];
const sameColor = (a: OkLCH, b: OkLCH): boolean =>
  a.L === b.L && a.C === b.C && a.H === b.H;

// The documented default schema's role per STEP-reporting token — the `step`/`auto`/`auto-on`
// bindings that resolve to a discrete ramp step (#160). The co-solved fills (`accent`,
// `accent-hover`, the four status fills), their labels (`on-*`), and the `scrim` literal are
// excluded — they report `fill`/`on-fill`/`literal`, not `step`. Mirrors DEFAULT_BINDING_SCHEMA.
const EXPECTED_ROLE: Partial<Record<BrandTokenName, RampRole>> = {
  // Surfaces (step) + neutral foregrounds (auto).
  bg: "neutral",
  surface: "neutral",
  "surface-2": "neutral",
  "surface-hover": "neutral",
  "surface-selected": "neutral",
  text: "neutral",
  "text-muted": "neutral",
  border: "neutral",
  // Brand foregrounds (auto).
  "accent-text": "brand",
  "focus-ring": "brand",
  // Status `<status>-text` (auto), `<status>-container` (step), `on-<status>-container` (auto-on).
  "error-text": "error",
  "error-container": "error",
  "on-error-container": "error",
  "warning-text": "warning",
  "warning-container": "warning",
  "on-warning-container": "warning",
  "success-text": "success",
  "success-container": "success",
  "on-success-container": "success",
  "info-text": "info",
  "info-container": "info",
  "on-info-container": "info",
};

const CONTINUOUS: BrandTokenName[] = ["accent", "on-accent"];

describe("deterministic snapshot (#70/#160): the full token set is bit-for-bit stable", () => {
  it.each(CASES)(
    "$key — every token, ramp, and the meta.bindings receipt match the committed golden",
    ({ key, seed, opts }) => {
      // The engine is a pure, deterministic function of its inputs — the FULL output (values +
      // the reported provenance) is pinned to the committed golden (regenerated wholesale for
      // the 34-token contract). A future change that accidentally perturbs any baked value or
      // any receipt fails here. Round-tripped through JSON so the compare matches the fixture's
      // shape exactly (no `undefined` / prototype differences).
      const set = JSON.parse(JSON.stringify(buildTokenSet(seed, opts)));
      expect(set).toEqual(golden[key]);
    },
  );

  it("the golden carries the #160 provenance receipt (guards the snapshot is complete)", () => {
    // If the fixture ever LOST `meta.bindings`, the snapshot check above would silently stop
    // covering the receipt. Prove the reference includes it for every case.
    for (const key of Object.keys(golden)) {
      const ref = golden[key] as { meta: Record<string, unknown> };
      expect(ref.meta).toHaveProperty("bindings");
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
          // The co-solve report kind: the `accent` token → "fill", `on-accent` → "on-fill"
          // (generalized #160 — the SHAPE is the discriminant; `role` carries the identity).
          expect(p!.kind, `${name}/${scheme}`).toBe(
            name === "accent" ? "fill" : "on-fill",
          );
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
        if (accentP?.kind !== "fill")
          throw new Error(`accent/${scheme}: expected accent report`);
        // `native` is the faithful-path flag — true iff the fill came from the native solve.
        // For every seed here that solve succeeds when this scheme is the seed's direction,
        // so it equals `scheme === direction`. `deltaL` is exactly the fill's L delta off the
        // seed — both recoverable without any value-scan of the ramps.
        expect(accentP.seed!.native).toBe(scheme === set.meta.direction);
        expect(accentP.seed!.deltaL).toBe(accent.L - s.L);

        const labelP = set.meta.bindings["on-accent"][scheme];
        if (labelP?.kind !== "on-fill")
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
        return p?.kind === "fill" ? p.seed!.native : null;
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
    if (p?.kind !== "on-fill") throw new Error("expected on-accent report");
    expect(p.chroma).toBeGreaterThan(0.03);
    expect(p.chroma).toBe(set.tokens["on-accent"].dark.C);
    expect(p.backedOff).toBe(p.chroma + 1e-4 < set.meta.seed.dark.C);
  });

  it("an achromatic seed's on-accent reports backedOff false (no chroma to give up)", () => {
    const set = buildTokenSet("#808080");
    for (const scheme of SCHEMES) {
      const p = set.meta.bindings["on-accent"][scheme];
      if (p?.kind !== "on-fill") throw new Error("expected on-accent report");
      expect(p.backedOff).toBe(false);
    }
  });
});

// The existing suite proves the co-solve report is truthful on 5 hand-picked seeds. The
// promise of #151 (report the story, never value-match) has to hold across the WHOLE input
// space, including the hostile corners the happy-path list skips: the full hue wheel, near-
// achromatic chroma, and the P3 gamut (wider chroma at high L changes which pole/backoff the
// label lands on). A single lie here — a `chroma` that isn't the label's own, a `pole` that
// disagrees with the baked lightness, a `deltaL` that isn't the fill's actual L offset, an
// off-scheme `native:true` — is a false receipt. Generative, so it can't miss the corner a
// fixed list forgets.
describe("QA — adversarial: co-solve report never lies across the hue wheel × gamut (#151)", () => {
  // 30° hue wheel × a coarse L/C grid × both gamuts. Kept deliberately modest (full theme
  // resolutions are compute-heavy — see palette.test.ts's SWEEP_TIMEOUT note / #41).
  const SWEEP_TIMEOUT = 30_000;
  const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const LS = [0.25, 0.5, 0.75];
  const CS = [0, 0.06, 0.18, 0.3];
  const GAMUTS = ["srgb", "p3"] as const;

  it(
    "accent + on-accent provenance is internally consistent for every seed on the grid",
    () => {
      for (const gamut of GAMUTS)
        for (const H of HUES)
          for (const L of LS)
            for (const C of CS) {
              const seed = `oklch(${L} ${C} ${H})`;
              const set = buildTokenSet(seed, { gamut });
              for (const scheme of SCHEMES) {
                const accent = set.tokens.accent[scheme];
                const onAccent = set.tokens["on-accent"][scheme];
                const s = set.meta.seed[scheme];
                const where = `${seed}/${scheme}/${gamut}`;

                const aP = set.meta.bindings.accent[scheme];
                if (aP?.kind !== "fill")
                  throw new Error(`${where}: expected accent report`);
                // native is the solve-path flag; off-scheme it can NEVER be true (no faithful
                // solve runs there). deltaL is exactly the fill's L offset from the seed.
                if (scheme !== set.meta.direction)
                  expect(aP.seed!.native, `${where} native`).toBe(false);
                expect(aP.seed!.deltaL, `${where} deltaL`).toBe(accent.L - s.L);

                const oP = set.meta.bindings["on-accent"][scheme];
                if (oP?.kind !== "on-fill")
                  throw new Error(`${where}: expected on-accent report`);
                // Every reported field must match the baked label, not an approximation.
                expect(oP.hue, `${where} hue`).toBe(s.H);
                expect(oP.chroma, `${where} chroma`).toBe(onAccent.C);
                expect(oP.pole, `${where} pole`).toBe(
                  onAccent.L >= accent.L ? "white" : "black",
                );
                expect(oP.backedOff, `${where} backedOff`).toBe(
                  onAccent.C + 1e-4 < s.C,
                );
              }
            }
    },
    SWEEP_TIMEOUT,
  );
});
