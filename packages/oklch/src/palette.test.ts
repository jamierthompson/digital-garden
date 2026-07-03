import { describe, expect, it } from "vitest";

import { buildTokenSet, resolveTheme } from "./palette";
import { minPass } from "./binding";
import { inGamut } from "./gamut";
import { apcaLc, contrastWCAG } from "./contrast";
import { formatOklch, parseColor } from "./convert";
import {
  RAMP_LABELS,
  type BrandTokenName,
  type OkLCH,
  type Ramp,
  type RampRole,
  type Scheme,
  type SchemeResult,
} from "./types";

const TOKEN_NAMES: BrandTokenName[] = [
  "bg",
  "surface",
  "surface-2",
  "text",
  "text-muted",
  "border",
  "accent",
  "accent-text",
  "on-accent",
  "focus-ring",
  "success",
  "error",
  "warning",
  "info",
];

const SCHEMES: Scheme[] = ["light", "dark"];

// Budget for the exhaustive correctness sweeps below. Each runs hundreds of FULL theme
// resolutions across both gamuts, both schemes, and a hue/L/chroma grid — deliberately
// thorough. Their nominal wall-time is healthy (~0.2s each, per `--reporter=verbose`), but
// they run under BOTH the node and jsdom Vitest projects AND alongside the rest of the
// suite, a production build, and (on an agent team) parallel work all competing for CPU.
// Under that contention a 0.2s test can dilate past Vitest's default 5s per-test budget and
// flake — the budget was the problem, not the engine (there is no perf bug; memoizing the
// per-hue gamut boundary is tracked separately as #41). A generous explicit budget removes
// the load-dependence without weakening the sweep.
const SWEEP_TIMEOUT = 30_000;

// The ramp role each ramp-bound semantic token derives from (the default binding schema).
// `accent`/`on-accent` are the faithful co-solve, not ramp steps, so they are excluded.
const TOKEN_ROLE: Partial<Record<BrandTokenName, RampRole>> = {
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

const RAMP_ROLES: RampRole[] = [
  "brand",
  "neutral",
  "success",
  "error",
  "warning",
  "info",
];

const sameColor = (a: OkLCH, b: OkLCH): boolean =>
  a.L === b.L && a.C === b.C && a.H === b.H;

const isRampStep = (c: OkLCH, ramp: Ramp): boolean =>
  ramp.some((s) => sameColor(s.color, c));

describe("ramp primitives + binding (#98)", () => {
  it.each(SCHEMES)(
    "exposes all six role ramps as 11 labelled, in-gamut, monotonic-lightness steps (%s)",
    (scheme) => {
      const { ramps } = resolveTheme("#3b82f6", scheme);
      for (const role of RAMP_ROLES) {
        const ramp = ramps[role];
        expect(
          ramp.map((s) => s.label),
          role,
        ).toEqual([...RAMP_LABELS]);
        for (let i = 1; i < ramp.length; i++) {
          expect(ramp[i].color.L, `${role} ${ramp[i].label}`).toBeLessThan(
            ramp[i - 1].color.L,
          );
        }
        for (const step of ramp) {
          expect(inGamut(step.color, "srgb"), `${role} ${step.label}`).toBe(
            true,
          );
          expect(typeof step.oog).toBe("boolean");
        }
      }
    },
  );

  // The load-bearing contract: "names, not numbers." Every ramp-bound semantic token IS a
  // concrete step of its role ramp — the token is a binding, not an independent solve.
  // Proven across hue-spanning seeds + fallback, both schemes.
  it("every ramp-bound token is exactly one of its role ramp's steps", () => {
    const seeds: unknown[] = [
      "#e11d48",
      "#eab308",
      "#06b6d4",
      "#7c3aed",
      "#0f3d3e",
      "#faf3c0",
      "garbage",
    ];
    for (const seed of seeds)
      for (const scheme of SCHEMES) {
        const { tokens, ramps } = resolveTheme(seed, scheme);
        for (const [name, role] of Object.entries(TOKEN_ROLE) as [
          BrandTokenName,
          RampRole,
        ][]) {
          expect(
            isRampStep(tokens[name], ramps[role]),
            `${name} should be a ${role} ramp step (${String(seed)}/${scheme})`,
          ).toBe(true);
        }
      }
  });

  it("binds surfaces to the documented fixed neutral steps, inverted per scheme", () => {
    const stepColor = (ramp: Ramp, label: string): OkLCH =>
      ramp.find((s) => s.label === label)!.color;
    const light = resolveTheme("#3b82f6", "light");
    const dark = resolveTheme("#3b82f6", "dark");
    // Light: page → elevated → higher taken from the light end (50/100/200).
    expect(light.tokens.bg).toEqual(stepColor(light.ramps.neutral, "50"));
    expect(light.tokens.surface).toEqual(stepColor(light.ramps.neutral, "100"));
    expect(light.tokens["surface-2"]).toEqual(
      stepColor(light.ramps.neutral, "200"),
    );
    // Dark: the dark end, inverted (950/900/800) — the "re-solve per scheme".
    expect(dark.tokens.bg).toEqual(stepColor(dark.ramps.neutral, "950"));
    expect(dark.tokens.surface).toEqual(stepColor(dark.ramps.neutral, "900"));
    expect(dark.tokens["surface-2"]).toEqual(
      stepColor(dark.ramps.neutral, "800"),
    );
  });

  it("on-accent is a near-white or near-black extreme (headroom label, #95), never a mid-tone", () => {
    const seeds = ["#e11d48", "#eab308", "#06b6d4", "#7c3aed", "#3b82f6"];
    for (const seed of seeds)
      for (const scheme of SCHEMES) {
        const { tokens } = resolveTheme(seed, scheme);
        const onAccent = tokens["on-accent"];
        // Extreme lightness (a near-white or near-black), near-zero chroma.
        expect(onAccent.L > 0.9 || onAccent.L < 0.2, `${seed}/${scheme}`).toBe(
          true,
        );
        expect(onAccent.C, `${seed}/${scheme}`).toBeLessThan(0.02);
        // …and it clears the on-accent floor on the accent fill (harness re-asserts too).
        expect(
          apcaLc(onAccent, tokens.accent),
          `${seed}/${scheme}`,
        ).toBeGreaterThanOrEqual(60);
      }
  });

  it("surfaces buildTokenSet.ramps as light/dark pairs for every role + step", () => {
    const set = buildTokenSet("#3b82f6");
    for (const role of RAMP_ROLES) {
      expect(set.ramps[role].light.map((s) => s.label)).toEqual([
        ...RAMP_LABELS,
      ]);
      expect(set.ramps[role].dark.map((s) => s.label)).toEqual([
        ...RAMP_LABELS,
      ]);
    }
    // The dual-scheme ramps agree with the single-scheme resolveTheme (one source of truth).
    expect(set.ramps.brand.light).toEqual(
      resolveTheme("#3b82f6", "light").ramps.brand,
    );
  });

  it("still exposes ramps on the fallback path (garbage seed)", () => {
    const { ramps, isFallback } = resolveTheme("not-a-color", "light");
    expect(isFallback).toBe(true);
    for (const role of RAMP_ROLES) {
      expect(ramps[role]).toHaveLength(11);
    }
  });

  // Guards that the surface the `auto` tokens are SOLVED against is exactly the `surface-2`
  // that SHIPS — the "AA on every surface" guarantee rests on those being identical. If the
  // internal worst-case surface ever drifted from the surface-2 token, `text` would be
  // minPass'd against a different background than it renders on, and this equality breaks.
  it("solves `text` against exactly the surface-2 token it ships (no worst-case-surface drift)", () => {
    for (const scheme of SCHEMES) {
      const { tokens, ramps } = resolveTheme("#3b82f6", scheme);
      // TARGET.bodyText — the documented body-text floor (palette.ts).
      const expected = minPass(ramps.neutral, tokens["surface-2"], {
        wcag: 4.5,
        apca: 75,
      }).color;
      expect(tokens.text, scheme).toEqual(expected);
    }
  });
});

describe("resolveTheme", () => {
  it.each(SCHEMES)(
    "emits every token, in gamut, for the %s scheme",
    (scheme) => {
      const { tokens } = resolveTheme("#3b82f6", scheme);
      for (const name of TOKEN_NAMES) {
        expect(tokens[name], name).toBeDefined();
        expect(inGamut(tokens[name], "srgb"), name).toBe(true);
      }
    },
  );

  it("is deterministic — same input → identical output", () => {
    expect(resolveTheme("#e11d48", "light")).toEqual(
      resolveTheme("#e11d48", "light"),
    );
    expect(resolveTheme("#e11d48", "dark")).toEqual(
      resolveTheme("#e11d48", "dark"),
    );
  });

  it("produces a light scheme with a light bg and a dark scheme with a dark bg", () => {
    expect(resolveTheme("#3b82f6", "light").tokens.bg.L).toBeGreaterThan(0.9);
    expect(resolveTheme("#3b82f6", "dark").tokens.bg.L).toBeLessThan(0.3);
  });

  it("dampens chroma in dark vs light for the seed", () => {
    const light = resolveTheme("#e11d48", "light");
    const dark = resolveTheme("#e11d48", "dark");
    expect(dark.seed.C).toBeLessThan(light.seed.C);
  });

  it("honors an explicit P3 gamut", () => {
    const { tokens } = resolveTheme("oklch(0.7 0.34 145)", "light", {
      gamut: "p3",
    });
    for (const name of TOKEN_NAMES) {
      expect(inGamut(tokens[name], "p3"), name).toBe(true);
    }
  });

  describe("defensive fallback", () => {
    it("never throws on garbage input and flags the fallback", () => {
      const bad: unknown[] = [
        "",
        "nonsense",
        "#zzz",
        null,
        undefined,
        42,
        {},
        [],
      ];
      for (const input of bad) {
        expect(() => resolveTheme(input, "light")).not.toThrow();
        const result = resolveTheme(input, "light");
        expect(result.isFallback).toBe(true);
        for (const name of TOKEN_NAMES) {
          expect(inGamut(result.tokens[name], "srgb"), name).toBe(true);
        }
      }
    });

    it("does NOT flag the fallback for a valid color", () => {
      expect(resolveTheme("#3b82f6", "light").isFallback).toBe(false);
    });

    it("returns a usable, deterministic fallback palette", () => {
      expect(resolveTheme("garbage", "light")).toEqual(
        resolveTheme("also garbage", "light"),
      );
    });
  });
});

// The engine's own contrast floors (accessibility-and-performance.md, mirrored by the
// palette's `TARGET`): a UI/non-text element clears WCAG 3:1 + APCA Lc 45; a label on the
// accent fill clears WCAG 4.5 + APCA Lc 60. Asserted below with the REAL contrast fns so
// these tests prove accessibility against the actual solved colors rather than snapshotting
// specific token values (which are free to change as the solve improves).
const UI_FLOOR = { wcag: 3, apca: 45 } as const;
const ON_ACCENT_FLOOR = { wcag: 4.5, apca: 60 } as const;

/**
 * Prove a resolved scheme is accessible: its accent reads as a UI element on the
 * worst-case surface (`surface-2`) and its on-accent label reads on the accent fill.
 */
function expectAccessibleAccent(result: SchemeResult, label: string): void {
  const surface2 = result.tokens["surface-2"];
  const { accent } = result.tokens;
  const onAccent = result.tokens["on-accent"];

  expect(
    contrastWCAG(accent, surface2),
    `${label}: accent WCAG vs surface-2`,
  ).toBeGreaterThanOrEqual(UI_FLOOR.wcag);
  expect(
    apcaLc(accent, surface2),
    `${label}: accent APCA vs surface-2`,
  ).toBeGreaterThanOrEqual(UI_FLOOR.apca);
  expect(
    contrastWCAG(onAccent, accent),
    `${label}: on-accent WCAG vs accent`,
  ).toBeGreaterThanOrEqual(ON_ACCENT_FLOOR.wcag);
  expect(
    apcaLc(onAccent, accent),
    `${label}: on-accent APCA vs accent`,
  ).toBeGreaterThanOrEqual(ON_ACCENT_FLOOR.apca);
}

describe("seed-lightness auto-direction", () => {
  // Faithful native accents anchor at the seed's own lightness; a mid seed may nudge a
  // few steps. This tolerance allows the nudge + gamut-map drift without pinning a value.
  const FAITHFUL_TOL = 0.05;

  it("assigns a too-light seed to the dark scheme (its native direction)", () => {
    // Very light yellow, L ≈ 0.96 — far too light to be a primary on a light surface.
    const seed = "#faf3c0";
    const light = resolveTheme(seed, "light");
    const dark = resolveTheme(seed, "dark");
    // Detected from the seed alone → both scheme calls agree.
    expect(light.direction).toBe("dark");
    expect(dark.direction).toBe("dark");
  });

  it("honors seed L in the native (dark) scheme for a too-light seed, derives the light scheme", () => {
    const seed = "#faf3c0";
    const light = resolveTheme(seed, "light");
    const dark = resolveTheme(seed, "dark");

    // Native scheme (dark): accent lightness ≈ the seed's own lightness (brand-faithful).
    expect(Math.abs(dark.tokens.accent.L - dark.seed.L)).toBeLessThan(
      FAITHFUL_TOL,
    );
    // Off scheme (light): derived — its accent is NOT anchored to the seed's (very light) L.
    expect(light.tokens.accent.L).toBeLessThan(dark.seed.L - 0.1);

    // Both schemes stay legible: accent reads as UI, on-accent reads on the fill.
    expectAccessibleAccent(light, "too-light seed / light");
    expectAccessibleAccent(dark, "too-light seed / dark");
  });

  it("honors seed L in the native (light) scheme for a deep seed", () => {
    // Deep teal, L ≈ 0.33 — a legible primary on a light surface.
    const seed = "#0f3d3e";
    const light = resolveTheme(seed, "light");
    const dark = resolveTheme(seed, "dark");

    expect(light.direction).toBe("light");
    expect(dark.direction).toBe("light");

    // Native scheme (light): accent lightness ≈ the seed's own lightness.
    expect(Math.abs(light.tokens.accent.L - light.seed.L)).toBeLessThan(
      FAITHFUL_TOL,
    );

    expectAccessibleAccent(light, "deep seed / light");
    expectAccessibleAccent(dark, "deep seed / dark");
  });

  it("agrees on direction across both scheme calls and through buildTokenSet.meta", () => {
    const seeds = [
      "#faf3c0",
      "#0f3d3e",
      "#3b82f6",
      "#e11d48",
      "#000080",
      "#ffff00",
    ];
    for (const seed of seeds) {
      const light = resolveTheme(seed, "light");
      const dark = resolveTheme(seed, "dark");
      expect(dark.direction, seed).toBe(light.direction);
      expect(buildTokenSet(seed).meta.direction, seed).toBe(light.direction);
    }
  });

  it("stays deterministic and legible for near-threshold boundary seeds", () => {
    // The detection flips around L ≈ 0.62–0.64 (an accent that just clears / just fails
    // the UI floor on a light surface). Straddle it: one just-below, one just-above.
    const boundary = ["oklch(0.60 0.12 145)", "oklch(0.66 0.12 145)"];
    for (const seed of boundary) {
      const light = resolveTheme(seed, "light");
      const dark = resolveTheme(seed, "dark");

      // A valid, defined direction either way.
      expect(["light", "dark"]).toContain(light.direction);
      // Deterministic across repeated calls.
      expect(resolveTheme(seed, "light")).toEqual(light);
      expect(resolveTheme(seed, "dark")).toEqual(dark);
      // Legible in BOTH schemes regardless of which side of the boundary it lands on.
      expectAccessibleAccent(light, `${seed} / light`);
      expectAccessibleAccent(dark, `${seed} / dark`);
    }
  });

  it("keeps both schemes accessible across hues and lightnesses (measured, not snapshotted)", () => {
    const hues = [29, 110, 145, 195, 260, 330];
    const lightnesses = [0.25, 0.45, 0.65, 0.85, 0.96];
    for (const H of hues) {
      for (const L of lightnesses) {
        const seed = `oklch(${L} 0.14 ${H})`;
        const light = resolveTheme(seed, "light");
        const dark = resolveTheme(seed, "dark");
        expect(["light", "dark"]).toContain(light.direction);
        expectAccessibleAccent(light, `${seed} / light`);
        expectAccessibleAccent(dark, `${seed} / dark`);
      }
    }
  });

  it("yields a valid direction on garbage input via the fallback, and never throws", () => {
    const bad: unknown[] = [
      "",
      "not-a-color",
      "#zzz",
      null,
      undefined,
      42,
      {},
      [],
    ];
    for (const input of bad) {
      expect(() => resolveTheme(input, "light")).not.toThrow();
      const light = resolveTheme(input, "light");
      const dark = resolveTheme(input, "dark");
      expect(light.isFallback, String(input)).toBe(true);
      // The fallback seed still resolves to a valid, agreed-upon direction.
      expect(["light", "dark"]).toContain(light.direction);
      expect(dark.direction, String(input)).toBe(light.direction);
      expect(buildTokenSet(input).meta.direction, String(input)).toBe(
        light.direction,
      );
      // …and the fallback palette is still accessible in whichever scheme is native.
      const native = light.direction === "light" ? light : dark;
      expectAccessibleAccent(native, `fallback(${String(input)}) / native`);
    }
  });

  it("keeps the too-light seed's parsed lightness above the light-native range (sanity on the fixture)", () => {
    // Guards the fixture itself: if #faf3c0 stopped being 'too light', the direction test
    // would pass vacuously. Parsed L must be high enough to be dark-native.
    const base = parseColor("#faf3c0");
    expect(base).not.toBeNull();
    expect(base?.L).toBeGreaterThan(0.9);
  });

  it("honors seed.L in the native scheme for a light-native upper-mid seed", () => {
    // The (~0.5, ~0.63] light-native band is where the nudge must go TOWARD the surface's
    // opposite pole (darker, here) to stay faithful — not away-from-mid. direction "light"
    // is a promise the accent is anchored near seed.L, not dropped to the derived scan.
    const r = resolveTheme("oklch(0.60 0.15 260)", "light");
    expect(r.direction).toBe("light");
    expect(Math.abs(r.tokens.accent.L - r.seed.L)).toBeLessThanOrEqual(0.1);
  });

  it("has no jarring accent-L discontinuity within one direction", () => {
    // A 0.02 step in seed L, both sides light-native, must not swing accent.L by ~0.19 —
    // the symptom of the native path silently falling through to the derived scan.
    const a = resolveTheme("oklch(0.56 0.15 260)", "light");
    const b = resolveTheme("oklch(0.58 0.15 260)", "light");
    expect(a.direction).toBe(b.direction);
    expect(Math.abs(a.tokens.accent.L - b.tokens.accent.L)).toBeLessThan(0.1);
  });
});

describe("status colors", () => {
  const STATUS_TOKENS: BrandTokenName[] = [
    "success",
    "error",
    "warning",
    "info",
  ];
  // Status colors are accessible signal FOREGROUNDS solved at the accent-text tier, so
  // they clear WCAG 4.5 + APCA Lc 60 against the worst-case surface (surface-2) — the same
  // floor `accent-text` clears. Measured with the REAL contrast fns, both schemes.
  const STATUS_FLOOR = { wcag: 4.5, apca: 60 } as const;

  it.each(SCHEMES)(
    "emits all four status tokens, finite + in gamut, for the %s scheme",
    (scheme) => {
      const { tokens } = resolveTheme("#3b82f6", scheme);
      for (const name of STATUS_TOKENS) {
        const c = tokens[name];
        expect(c, name).toBeDefined();
        expect(
          Number.isFinite(c.L) && Number.isFinite(c.C) && Number.isFinite(c.H),
          name,
        ).toBe(true);
        expect(inGamut(c, "srgb"), name).toBe(true);
      }
    },
  );

  // The per-hue solve is the whole point: a fixed ΔL that passes for red fails for yellow.
  // Prove EACH canonical hue clears the floor — warning (yellow) + success (green) + info
  // (cyan-ish blue) are the stressers — across hue-spanning brand seeds AND the fallback,
  // in BOTH schemes. Status colors don't depend on the brand hue, so a garbage seed (which
  // routes through the fallback surface) must still emit accessible status colors.
  const SEEDS: unknown[] = [
    "#e11d48", // crimson
    "#eab308", // amber brand
    "#16a34a", // emerald brand
    "#06b6d4", // cyan brand
    "#7c3aed", // violet
    "garbage", // → fallback palette
    null,
    42,
  ];

  it.each(SCHEMES)(
    "every status color clears its floor on surface-2 across brands + fallback (%s)",
    (scheme) => {
      for (const seed of SEEDS) {
        const { tokens } = resolveTheme(seed, scheme);
        const surface2 = tokens["surface-2"];
        for (const name of STATUS_TOKENS) {
          const c = tokens[name];
          const where = `${name}/${scheme}/${String(seed)}`;
          expect(inGamut(c, "srgb"), where).toBe(true);
          expect(
            contrastWCAG(c, surface2),
            `${where} WCAG`,
          ).toBeGreaterThanOrEqual(STATUS_FLOOR.wcag);
          expect(apcaLc(c, surface2), `${where} APCA`).toBeGreaterThanOrEqual(
            STATUS_FLOOR.apca,
          );
        }
      }
    },
  );

  it("garbage brandColor → isFallback true AND all four status colors present + accessible", () => {
    const result = resolveTheme("not-a-color", "light");
    expect(result.isFallback).toBe(true);
    const surface2 = result.tokens["surface-2"];
    for (const name of STATUS_TOKENS) {
      const c = result.tokens[name];
      expect(c, name).toBeDefined();
      expect(contrastWCAG(c, surface2), name).toBeGreaterThanOrEqual(
        STATUS_FLOOR.wcag,
      );
      expect(apcaLc(c, surface2), name).toBeGreaterThanOrEqual(
        STATUS_FLOOR.apca,
      );
    }
  });

  it("is deterministic — same input → identical status colors", () => {
    const a = resolveTheme("#3b82f6", "dark");
    const b = resolveTheme("#3b82f6", "dark");
    for (const name of STATUS_TOKENS) {
      expect(a.tokens[name], name).toEqual(b.tokens[name]);
    }
  });

  // Locks the accessibility promise the docs make ("any brand, both schemes, both gamuts"):
  // a dense hue × L × chroma sweep in sRGB AND P3, measured with the real contrast fns.
  it(
    "every status color clears its floor across a hue/L/chroma sweep (sRGB + P3)",
    () => {
      const gamuts = ["srgb", "p3"] as const;
      const Hs = [0, 27, 80, 145, 250, 330];
      const Ls = [0.1, 0.5, 0.9];
      const Cs = [0, 0.15, 0.35];
      for (const gamut of gamuts)
        for (const H of Hs)
          for (const L of Ls)
            for (const C of Cs)
              for (const scheme of SCHEMES) {
                const { tokens } = resolveTheme(
                  `oklch(${L} ${C} ${H})`,
                  scheme,
                  {
                    gamut,
                  },
                );
                const surface2 = tokens["surface-2"];
                for (const name of STATUS_TOKENS) {
                  const c = tokens[name];
                  const where = `${name}/${scheme}/${gamut}/H${H}L${L}C${C}`;
                  expect(inGamut(c, gamut), where).toBe(true);
                  expect(
                    contrastWCAG(c, surface2),
                    `${where} WCAG`,
                  ).toBeGreaterThanOrEqual(STATUS_FLOOR.wcag);
                  expect(
                    apcaLc(c, surface2),
                    `${where} APCA`,
                  ).toBeGreaterThanOrEqual(STATUS_FLOOR.apca);
                }
              }
    },
    SWEEP_TIMEOUT,
  );

  // Documents the intended design: because the hue is fixed-canonical and surface-2's brand
  // tint is capped tiny, status colors are near brand-invariant — two wildly different brands
  // land within a hair. Guards against an accidental brand-hue leak into the status solve.
  it("status colors are near brand-invariant (fixed canonical hue, only the surface-tint whisper varies)", () => {
    const a = resolveTheme("#e11d48", "light").tokens; // crimson brand
    const b = resolveTheme("#06b6d4", "light").tokens; // cyan brand
    for (const name of STATUS_TOKENS) {
      // L barely moves and the hue stays within a sub-2° wobble (from gamut-mapping against
      // the brand-tinted surface) — the canonical anchor dominates, no brand-hue leak.
      expect(Math.abs(a[name].L - b[name].L), `${name} L`).toBeLessThan(0.02);
      expect(Math.abs(a[name].H - b[name].H), `${name} H`).toBeLessThan(2);
    }
  });
});

describe("buildTokenSet", () => {
  it("zips both schemes into light/dark pairs for every token", () => {
    const set = buildTokenSet("#3b82f6");
    for (const name of TOKEN_NAMES) {
      expect(set.tokens[name].light, name).toBeDefined();
      expect(set.tokens[name].dark, name).toBeDefined();
    }
    expect(set.meta.gamut).toBe("srgb");
    expect(set.meta.isFallback).toBe(false);
  });

  it("agrees with resolveTheme per scheme (single source of truth)", () => {
    const set = buildTokenSet("#e11d48");
    const light = resolveTheme("#e11d48", "light");
    const dark = resolveTheme("#e11d48", "dark");
    expect(set.tokens.accent.light).toEqual(light.tokens.accent);
    expect(set.tokens.accent.dark).toEqual(dark.tokens.accent);
  });

  it("flags the fallback through to meta on bad input", () => {
    expect(buildTokenSet("not-a-color").meta.isFallback).toBe(true);
  });
});

// The Studio's author-time `brandColor` validation (studio/schemaTypes/shared/
// colorValidation.ts) is a thin wrapper over THIS call: it accepts a value iff
// `buildTokenSet(value).meta.isFallback === false`. The Studio has no test
// runner of its own and shouldn't grow one for ~3 lines of glue; the contract that
// actually matters — "what does the engine consider usable?" — is engine behavior, so
// it's pinned here, where the runner already exists. This is the validation oracle:
// `isFallback === false` ⇔ Studio accepts. If this boundary ever moves, author-time
// validation moves with it — which is the point.
describe("brandColor validation contract (the Studio's isFallback oracle)", () => {
  // Inputs an editor would type that the engine CAN theme with → Studio accepts.
  it.each([
    "#4f46e5", // 6-digit hex (the documented example)
    "#f00", // 3-digit shorthand hex
    "#00ff0080", // 8-digit hex (alpha ignored)
    "oklch(0.62 0.19 256)", // oklch() literal (the documented example)
    "oklch(62% 0.19 256)", // oklch() with percentage L
    "rgb(79, 70, 229)", // rgb() — accepted by the engine
    "  #4f46e5  ", // surrounding whitespace is tolerated
  ])("accepts %j (engine parses it → not a fallback)", (input) => {
    expect(buildTokenSet(input).meta.isFallback).toBe(false);
  });

  // Inputs the engine CANNOT parse → fallback → Studio rejects.
  it.each([
    "not-a-color",
    "#xyz", // non-hex digits
    "#abcd", // 4-digit hex — the engine has no #rgba form, so this falls back
    "rgb()", // malformed function
    "", // empty (the wrapper also short-circuits this to "allowed", paired with .required())
    "   ", // whitespace only
  ])("rejects %j (engine falls back)", (input) => {
    expect(buildTokenSet(input).meta.isFallback).toBe(true);
  });
});

describe("baked literals clear the TRUE contrast floor (#79)", () => {
  // Each solved foreground token, the worst-case background it is solved against, and the
  // TRUE floor (no margin) it must clear. The engine solves with a small margin
  // (`withSolveMargin`, contrast.ts) so the 4-dp-rounded SHIPPED literal — not just the
  // pre-round math — still clears these floors. Surfaces (bg/surface/surface-2) are
  // near-neutral fills, not contrast-solved, so they have no floor of their own.
  const CONTRACT: Record<
    string,
    { bg: BrandTokenName; wcag: number; apca: number }
  > = {
    text: { bg: "surface-2", wcag: 4.5, apca: 75 },
    "text-muted": { bg: "surface-2", wcag: 4.5, apca: 60 },
    border: { bg: "surface-2", wcag: 3, apca: 30 },
    "accent-text": { bg: "surface-2", wcag: 4.5, apca: 60 },
    "focus-ring": { bg: "surface-2", wcag: 3, apca: 45 },
    accent: { bg: "surface-2", wcag: 3, apca: 45 }, // fill reads as UI on the surface
    "on-accent": { bg: "accent", wcag: 4.5, apca: 60 }, // label on the fill
    success: { bg: "surface-2", wcag: 4.5, apca: 60 },
    error: { bg: "surface-2", wcag: 4.5, apca: 60 },
    warning: { bg: "surface-2", wcag: 4.5, apca: 60 },
    info: { bg: "surface-2", wcag: 4.5, apca: 60 },
  };
  // Round-trip a token through the exact bake path (formatOklch → parseColor) to measure
  // what actually ships, not the precise solver output.
  const bake = (c: OkLCH): OkLCH => parseColor(formatOklch(c))!;
  // A generated hue × L × chroma sweep, NOT a handful of fixed seeds — the accent fill /
  // on-accent path solves on a discrete-L scan whose floor-hugging edge only shows under a
  // real sweep (a fixed-seed list silently misses it). Plus QA's exact accent-path edge
  // seeds and the fallback.
  const SEEDS: unknown[] = [
    ...[0, 45, 90, 130, 150, 200, 238, 278, 320].flatMap((H) =>
      [0.4, 0.6, 0.82].flatMap((L) =>
        [0.15, 0.28].map((C) => `oklch(${L} ${C} ${H})`),
      ),
    ),
    "oklch(0.6 0.28 150)", // QA B1 edge: baked on-accent hit 4.4998 pre-fix
    "oklch(0.75 0.28 204)",
    "oklch(0.7 0.2 238)",
    "garbage", // → fallback
  ];
  const GAMUTS = ["srgb", "p3"] as const;

  it(
    "every solved foreground token clears its true floor as the BAKED (rounded) literal",
    () => {
      for (const gamut of GAMUTS)
        for (const scheme of SCHEMES)
          for (const seed of SEEDS) {
            const { tokens } = resolveTheme(seed, scheme, { gamut });
            for (const [name, c] of Object.entries(CONTRACT)) {
              const fg = bake(tokens[name as BrandTokenName]);
              const bg = bake(tokens[c.bg]);
              const where = `${name}/${scheme}/${gamut}/${String(seed)}`;
              expect(
                contrastWCAG(fg, bg),
                `${where} WCAG`,
              ).toBeGreaterThanOrEqual(c.wcag);
              expect(apcaLc(fg, bg), `${where} APCA`).toBeGreaterThanOrEqual(
                c.apca,
              );
            }
          }
    },
    SWEEP_TIMEOUT,
  );
});

describe("seed anchor-step (#108)", () => {
  it("the brand ramp's anchored step IS the seed's exact color (light-native seed)", () => {
    const result = resolveTheme("#2563eb", "light");
    expect(result.direction).toBe("light");
    expect(result.anchorLabel).toBe("500");
    const anchored = result.ramps.brand.find(
      (s) => s.label === result.anchorLabel,
    )!;
    expect(anchored.color.L).toBeCloseTo(result.seed.L, 9);
    expect(anchored.color.C).toBeCloseTo(result.seed.C, 9);
    expect(anchored.color.H).toBeCloseTo(result.seed.H, 9);
  });

  it("a dark-native (light-colored) seed anchors the light 300 step", () => {
    const result = resolveTheme("#facc15", "light"); // light yellow — no light-mode primary
    expect(result.direction).toBe("dark");
    expect(result.anchorLabel).toBe("300");
    const anchored = result.ramps.brand.find((s) => s.label === "300")!;
    expect(anchored.color.L).toBeCloseTo(result.seed.L, 9);
  });

  it("anchors the brand ramp in BOTH schemes at the same label", () => {
    for (const scheme of ["light", "dark"] as const) {
      const result = resolveTheme("#dc2626", scheme);
      const anchored = result.ramps.brand.find(
        (s) => s.label === result.anchorLabel,
      )!;
      // Same L in both schemes (only chroma dampens in dark).
      expect(anchored.color.L).toBeCloseTo(result.seed.L, 9);
    }
  });

  it("only the brand ramp is anchored — neutral/status stay on the shared scale", () => {
    // Same hue, different seed L: only the anchor input differs between the two runs.
    const a = resolveTheme("oklch(0.45 0.15 260)", "light");
    const b = resolveTheme("oklch(0.7 0.15 260)", "light");
    // Neutral tracks the seed hue but NOT its lightness; status hues are fixed — all
    // four are seed-independent. Identical at full precision.
    for (const role of [
      "neutral",
      "success",
      "error",
      "warning",
      "info",
    ] as const) {
      expect(a.ramps[role]).toEqual(b.ramps[role]);
    }
    // …while the brand ramps genuinely differ at their anchored steps.
    const stepOf = (r: typeof a, label: string) =>
      r.ramps.brand.find((s) => s.label === label)!;
    expect(stepOf(a, a.anchorLabel).color.L).not.toBeCloseTo(
      stepOf(b, b.anchorLabel).color.L,
      2,
    );
  });

  it("the NATIVE-scheme accent lands exactly on the anchored ramp step", () => {
    // The faithful co-solve's delta-0 candidate and the anchored step are built from the
    // same (L, C, H) — when the candidate passes, the accent IS a ramp step (#108's
    // point: the seed's own color sits on the ramp). Checked in each seed's native scheme.
    for (const seed of ["#2563eb", "#dc2626", "#facc15"]) {
      const direction = resolveTheme(seed, "light").direction;
      const result = resolveTheme(seed, direction);
      const anchored = result.ramps.brand.find(
        (s) => s.label === result.anchorLabel,
      )!;
      expect(result.tokens.accent).toEqual(anchored.color);
    }
  });

  it("anchoring holds across seed lightnesses (harness-style sweep)", () => {
    for (const hex of ["#1e3a8a", "#dc2626", "#16a34a", "#eab308", "#06b6d4"]) {
      for (const scheme of ["light", "dark"] as const) {
        const result = resolveTheme(hex, scheme);
        const anchored = result.ramps.brand.find(
          (s) => s.label === result.anchorLabel,
        )!;
        expect(anchored.color.L).toBeCloseTo(result.seed.L, 9);
        // The bent ramp stays strictly monotonic.
        for (let i = 1; i < result.ramps.brand.length; i++) {
          expect(result.ramps.brand[i].color.L).toBeLessThan(
            result.ramps.brand[i - 1].color.L,
          );
        }
      }
    }
  });

  it("buildTokenSet surfaces the anchor label in meta", () => {
    expect(buildTokenSet("#2563eb").meta.anchorLabel).toBe("500");
    expect(buildTokenSet("#facc15").meta.anchorLabel).toBe("300");
  });
});

describe("generative rules threading (#101)", () => {
  it("explicit all-default rules reproduce the optionless output exactly, both schemes", () => {
    const rules = {
      distribution: "tailwind",
      chromaPolicy: "flat",
      huePolicy: "constant",
      tintedNeutrals: true,
    } as const;
    for (const scheme of SCHEMES) {
      expect(resolveTheme("#2563eb", scheme, { rules })).toEqual(
        resolveTheme("#2563eb", scheme),
      );
    }
    expect(buildTokenSet("#2563eb", { rules })).toEqual(
      buildTokenSet("#2563eb"),
    );
  });

  it("tintedNeutrals: false yields pure achromatic greys; the default keeps the tint", () => {
    const grey = resolveTheme("#2563eb", "light", {
      rules: { tintedNeutrals: false },
    });
    for (const step of grey.ramps.neutral) {
      expect(step.color.C).toBe(0);
    }
    const tinted = resolveTheme("#2563eb", "light");
    expect(tinted.ramps.neutral.some((step) => step.color.C > 0)).toBe(true);
  });

  it("a distribution reshapes the interior but never the pinned surfaces", () => {
    const plain = resolveTheme("#2563eb", "light");
    for (const distribution of ["linear", "soft", "punchy"] as const) {
      const ruled = resolveTheme("#2563eb", "light", {
        rules: { distribution },
      });
      // The surface trio binds shoulder steps — identical under every distribution
      // (this is what keeps the worst-case surface, and so the AA guarantee, intact).
      expect(ruled.tokens.bg).toEqual(plain.tokens.bg);
      expect(ruled.tokens.surface).toEqual(plain.tokens.surface);
      expect(ruled.tokens["surface-2"]).toEqual(plain.tokens["surface-2"]);
      // …while the interior of the neutral scale genuinely moves.
      const midL = (r: SchemeResult): number[] =>
        r.ramps.neutral.slice(3, 8).map((s) => s.color.L);
      expect(midL(ruled)).not.toEqual(midL(plain));
    }
  });

  it(
    "contrast guarantees hold under every policy, one-at-a-time, both schemes",
    () => {
      const VARIATIONS: Array<Record<string, unknown>> = [
        { distribution: "linear" },
        { distribution: "eased" },
        { distribution: "punchy" },
        { distribution: "soft" },
        { chromaPolicy: "taper" },
        { chromaPolicy: "hold" },
        { huePolicy: "warm-shadows" },
        { huePolicy: "cool-highlights" },
        { tintedNeutrals: false },
      ];
      // Foreground tokens vs the worst-case surface they are solved against, at their
      // schema targets (palette.ts TARGET table).
      const FLOORS: Array<[BrandTokenName, number, number]> = [
        ["text", 4.5, 75],
        ["text-muted", 4.5, 60],
        ["border", 3, 30],
        ["accent-text", 4.5, 60],
        ["focus-ring", 3, 45],
        ["success", 4.5, 60],
        ["error", 4.5, 60],
        ["warning", 4.5, 60],
        ["info", 4.5, 60],
      ];
      for (const rules of VARIATIONS)
        for (const seed of ["#2563eb", "#eab308", "#06b6d4"])
          for (const scheme of SCHEMES) {
            const { tokens } = resolveTheme(seed, scheme, { rules });
            const bg = tokens["surface-2"];
            for (const [name, wcag, apca] of FLOORS) {
              const label = `${name} ${JSON.stringify(rules)} ${seed}/${scheme}`;
              expect(
                contrastWCAG(tokens[name], bg),
                label,
              ).toBeGreaterThanOrEqual(wcag);
              expect(apcaLc(tokens[name], bg), label).toBeGreaterThanOrEqual(
                apca,
              );
            }
            // The accent fill + its label keep their co-solved guarantees too.
            expect(
              contrastWCAG(tokens["on-accent"], tokens.accent),
              `on-accent ${JSON.stringify(rules)} ${seed}/${scheme}`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
              apcaLc(tokens["on-accent"], tokens.accent),
              `on-accent ${JSON.stringify(rules)} ${seed}/${scheme}`,
            ).toBeGreaterThanOrEqual(60);
          }
    },
    SWEEP_TIMEOUT,
  );
});
