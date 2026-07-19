import { describe, expect, it } from "vitest";

import { buildTokenSet, DEFAULT_BINDING_SCHEMA, resolveTheme } from "./palette";
import { minPass } from "./binding";
import { inGamut } from "./gamut";
import { apcaLc, contrastWCAG } from "./contrast";
import { formatOklch, parseColor } from "./convert";
import {
  THEME_TOKEN_NAMES,
  RAMP_LABELS,
  type ThemeTokenName,
  type OkLCH,
  type Ramp,
  type RampRole,
  type Scheme,
  type SchemeResult,
} from "./types";

// Derived from the engine's own contract, so this list can never silently drift from it
// (a hand-maintained copy once shipped 32 entries, dropping the two state surfaces from
// every sweep it drives — QA nit, #160).
const TOKEN_NAMES: readonly ThemeTokenName[] = THEME_TOKEN_NAMES;

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
// The co-solved FILLS (`accent`, `accent-hover`, and every `<status>` + `<status>-foreground`) and the
// `scrim` literal are NOT ramp steps, so they are excluded. Each status contributes three
// ramp-bound tokens: `<status>-text` (auto), `<status>-subtle` (pinned step), and
// `<status>-subtle-foreground` (auto-on) — all steps of that status's ramp (#160).
const TOKEN_ROLE: Partial<Record<ThemeTokenName, RampRole>> = {
  background: "neutral",
  surface: "neutral",
  "surface-elevated": "neutral",
  foreground: "neutral",
  muted: "neutral",
  "muted-foreground": "neutral",
  border: "neutral",
  "accent-text": "accent",
  "accent-subtle": "accent",
  "accent-subtle-foreground": "accent",
  ring: "accent",
  "error-text": "error",
  "error-subtle": "error",
  "error-subtle-foreground": "error",
  "warning-text": "warning",
  "warning-subtle": "warning",
  "warning-subtle-foreground": "warning",
  "success-text": "success",
  "success-subtle": "success",
  "success-subtle-foreground": "success",
  "info-text": "info",
  "info-subtle": "info",
  "info-subtle-foreground": "info",
};

const RAMP_ROLES: RampRole[] = [
  "accent",
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
          ThemeTokenName,
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
    expect(light.tokens.background).toEqual(
      stepColor(light.ramps.neutral, "50"),
    );
    expect(light.tokens.surface).toEqual(stepColor(light.ramps.neutral, "100"));
    expect(light.tokens["surface-elevated"]).toEqual(
      stepColor(light.ramps.neutral, "200"),
    );
    // Dark: the dark end, inverted (950/900/800) — the "re-solve per scheme".
    expect(dark.tokens.background).toEqual(
      stepColor(dark.ramps.neutral, "950"),
    );
    expect(dark.tokens.surface).toEqual(stepColor(dark.ramps.neutral, "900"));
    expect(dark.tokens["surface-elevated"]).toEqual(
      stepColor(dark.ramps.neutral, "800"),
    );
  });

  it("accent-foreground clears the accent-foreground floor on the fill and lands far in lightness (#153)", () => {
    const seeds = ["#e11d48", "#eab308", "#06b6d4", "#7c3aed", "#3b82f6"];
    for (const seed of seeds)
      for (const scheme of SCHEMES) {
        const { tokens } = resolveTheme(seed, scheme);
        const accentForeground = tokens["accent-foreground"];
        // Legibility never regresses: the label clears WCAG 4.5 + APCA Lc 60 on the fill.
        expect(
          contrastWCAG(accentForeground, tokens.accent),
          `${seed}/${scheme}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          apcaLc(accentForeground, tokens.accent),
          `${seed}/${scheme}`,
        ).toBeGreaterThanOrEqual(60);
        // Contrast is luminance-based, so the label always lands FAR from the fill in
        // lightness — the chromatic solve wins chroma, never a mid-tone "orange on purple".
        expect(
          Math.abs(accentForeground.L - tokens.accent.L),
          `${seed}/${scheme}`,
        ).toBeGreaterThan(0.3);
      }
  });

  it("accent-foreground degrades to today's achromatic extreme for an achromatic seed (#153 = C→0 limit)", () => {
    // Strict generalization: no seed chroma to spend → the label is the same near-white/
    // near-black extreme (bit-for-bit) as before #153, so legibility can never regress.
    for (const scheme of SCHEMES) {
      const accentForeground = resolveTheme("#808080", scheme).tokens[
        "accent-foreground"
      ];
      expect(accentForeground.C, scheme).toBeLessThan(1e-6);
      expect(accentForeground.L > 0.9 || accentForeground.L < 0.2, scheme).toBe(
        true,
      );
    }
  });

  it("accent-foreground becomes CHROMATIC where the fill + gamut allow it (#153 — gold-on-navy)", () => {
    // A navy fill in dark mode hosts a chromatic light label — the whole point of #153. The
    // label carries real accent chroma at the accent hue, not a bleached near-white.
    const { tokens } = resolveTheme("#3b82f6", "dark");
    const accentForeground = tokens["accent-foreground"];
    expect(accentForeground.C).toBeGreaterThan(0.03);
    // Still a legible, luminance-driven label (clears the floor with the chroma it kept).
    expect(apcaLc(accentForeground, tokens.accent)).toBeGreaterThanOrEqual(60);
  });

  it("the 4-dp-BAKED accent-foreground literal still clears the TRUE floor on the baked fill (#79/#153)", () => {
    // The acceptance bar: after formatOklch's 4-dp rounding, the shipped literal must still
    // clear 4.5:1 + Lc 60 — the #79 solve margin has to cover the chromatic label too.
    const seeds = [
      "#3b82f6",
      "#e11d48",
      "#eab308",
      "#06b6d4",
      "#7c3aed",
      "#808080",
    ];
    for (const seed of seeds)
      for (const scheme of SCHEMES) {
        const { tokens } = resolveTheme(seed, scheme);
        const label = parseColor(formatOklch(tokens["accent-foreground"]))!;
        const fill = parseColor(formatOklch(tokens.accent))!;
        expect(
          contrastWCAG(label, fill),
          `${seed}/${scheme} WCAG`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          apcaLc(label, fill),
          `${seed}/${scheme} Lc`,
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
    expect(set.ramps.accent.light).toEqual(
      resolveTheme("#3b82f6", "light").ramps.accent,
    );
  });

  it("still exposes ramps on the fallback path (garbage seed)", () => {
    const { ramps, isFallback } = resolveTheme("not-a-color", "light");
    expect(isFallback).toBe(true);
    for (const role of RAMP_ROLES) {
      expect(ramps[role]).toHaveLength(11);
    }
  });

  // Guards that the surface the `auto` tokens are SOLVED against is exactly the
  // `surface-selected` that SHIPS — the "AA on every surface" guarantee rests on those being
  // identical. If the internal worst-case surface ever drifted from the surface-selected
  // token, `text` would be minPass'd against a different background than it renders on, and
  // this equality breaks.
  it("solves `text` against exactly the surface-selected token it ships (no worst-case-surface drift)", () => {
    for (const scheme of SCHEMES) {
      const { tokens, ramps } = resolveTheme("#3b82f6", scheme);
      // Worst-case surface is `surface-selected` (#160 — the darkest text-bearing surface);
      // CONTRAST_TARGETS.bodyText is the documented body-text floor (palette.ts).
      const expected = minPass(ramps.neutral, tokens["surface-selected"], {
        wcag: 4.5,
        apca: 75,
      }).color;
      expect(tokens.foreground, scheme).toEqual(expected);
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
    expect(
      resolveTheme("#3b82f6", "light").tokens.background.L,
    ).toBeGreaterThan(0.9);
    expect(resolveTheme("#3b82f6", "dark").tokens.background.L).toBeLessThan(
      0.3,
    );
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
// palette's `CONTRAST_TARGETS`): a UI/non-text element clears WCAG 3:1 + APCA Lc 45; a label on the
// accent fill clears WCAG 4.5 + APCA Lc 60. Asserted below with the REAL contrast fns so
// these tests prove accessibility against the actual solved colors rather than snapshotting
// specific token values (which are free to change as the solve improves).
const UI_FLOOR = { wcag: 3, apca: 45 } as const;
const ON_ACCENT_FLOOR = { wcag: 4.5, apca: 60 } as const;

/**
 * Prove a resolved scheme is accessible: its accent reads as a UI element on `surface-elevated`
 * (implied a fortiori by the `surface-selected` worst-case solve, #160) and its accent-foreground
 * label reads on the accent fill.
 */
function expectAccessibleAccent(result: SchemeResult, label: string): void {
  const surface2 = result.tokens["surface-elevated"];
  const { accent } = result.tokens;
  const accentForeground = result.tokens["accent-foreground"];

  expect(
    contrastWCAG(accent, surface2),
    `${label}: accent WCAG vs surface-elevated`,
  ).toBeGreaterThanOrEqual(UI_FLOOR.wcag);
  expect(
    apcaLc(accent, surface2),
    `${label}: accent APCA vs surface-elevated`,
  ).toBeGreaterThanOrEqual(UI_FLOOR.apca);
  expect(
    contrastWCAG(accentForeground, accent),
    `${label}: accent-foreground WCAG vs accent`,
  ).toBeGreaterThanOrEqual(ON_ACCENT_FLOOR.wcag);
  expect(
    apcaLc(accentForeground, accent),
    `${label}: accent-foreground APCA vs accent`,
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

    // Native scheme (dark): accent lightness ≈ the seed's own lightness (seed-faithful).
    expect(Math.abs(dark.tokens.accent.L - dark.seed.L)).toBeLessThan(
      FAITHFUL_TOL,
    );
    // Off scheme (light): derived — its accent is NOT anchored to the seed's (very light) L.
    expect(light.tokens.accent.L).toBeLessThan(dark.seed.L - 0.1);

    // Both schemes stay legible: accent reads as UI, accent-foreground reads on the fill.
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
    // Inside the light-native band (seed L up to ~0.56 against the worst-case light surface
    // `surface-selected`, #160), direction "light" is a promise the accent is anchored near
    // seed.L, not dropped to the derived scan.
    const r = resolveTheme("oklch(0.52 0.15 260)", "light");
    expect(r.direction).toBe("light");
    expect(Math.abs(r.tokens.accent.L - r.seed.L)).toBeLessThanOrEqual(0.1);
  });

  it("has no jarring accent-L discontinuity within one direction", () => {
    // A 0.02 step in seed L, both sides light-native, must not swing accent.L by ~0.19 —
    // the symptom of the native path silently falling through to the derived scan.
    const a = resolveTheme("oklch(0.52 0.15 260)", "light");
    const b = resolveTheme("oklch(0.54 0.15 260)", "light");
    expect(a.direction).toBe(b.direction);
    expect(Math.abs(a.tokens.accent.L - b.tokens.accent.L)).toBeLessThan(0.1);
  });
});

describe("status colors (trios + subtle surfaces, #160)", () => {
  const STATUS = ["success", "error", "warning", "info"] as const;
  const fillName = (s: string): ThemeTokenName => s as ThemeTokenName;
  const fillForegroundName = (s: string): ThemeTokenName =>
    `${s}-foreground` as ThemeTokenName;
  const textName = (s: string): ThemeTokenName => `${s}-text` as ThemeTokenName;
  const subtleName = (s: string): ThemeTokenName =>
    `${s}-subtle` as ThemeTokenName;
  const onSubtleName = (s: string): ThemeTokenName =>
    `${s}-subtle-foreground` as ThemeTokenName;
  const allOf = (s: string): ThemeTokenName[] => [
    fillName(s),
    fillForegroundName(s),
    textName(s),
    subtleName(s),
    onSubtleName(s),
  ];

  // `<status>-text` keeps TODAY's status semantics — an accessible signal FOREGROUND at the
  // accent-text tier (WCAG 4.5 + APCA Lc 60 vs the worst-case surface, surface-selected).
  const TEXT_FLOOR = { wcag: 4.5, apca: 60 } as const;
  // The FILL is a co-solved signal color: it reads as a UI element on the surface (non-text
  // 3:1 / Lc 45)…
  const FILL_FLOOR = { wcag: 3, apca: 45 } as const;
  // …and hosts its label at 4.5 / Lc 60 — the same floor a subtle surface's label clears.
  const LABEL_FLOOR = { wcag: 4.5, apca: 60 } as const;

  // Status colors don't depend on the accent hue, so a garbage seed (→ fallback surface) must
  // still emit accessible status colors. Hue-spanning themes cover the per-hue solve.
  const SEEDS: unknown[] = [
    "#e11d48", // crimson
    "#eab308", // amber seed
    "#16a34a", // emerald seed
    "#06b6d4", // cyan seed
    "#7c3aed", // violet
    "garbage", // → fallback palette
    null,
    42,
  ];

  it.each(SCHEMES)(
    "emits all five tokens per status, finite + in gamut, for the %s scheme",
    (scheme) => {
      const { tokens } = resolveTheme("#3b82f6", scheme);
      for (const s of STATUS)
        for (const name of allOf(s)) {
          const c = tokens[name];
          expect(c, name).toBeDefined();
          expect(
            Number.isFinite(c.L) &&
              Number.isFinite(c.C) &&
              Number.isFinite(c.H),
            name,
          ).toBe(true);
          expect(inGamut(c, "srgb"), name).toBe(true);
        }
    },
  );

  // The rename-with-guarantee, measured live: `<status>-text` clears the accent-text floor on
  // surface-elevated — the exact promise the OLD `<status>` token made (goldens prove bit-identity).
  it.each(SCHEMES)(
    "<status>-text clears the accent-text floor on surface-elevated across themes + fallback (%s)",
    (scheme) => {
      for (const seed of SEEDS) {
        const { tokens } = resolveTheme(seed, scheme);
        const surface2 = tokens["surface-elevated"];
        for (const s of STATUS) {
          const c = tokens[textName(s)];
          const where = `${s}-text/${scheme}/${String(seed)}`;
          expect(inGamut(c, "srgb"), where).toBe(true);
          expect(
            contrastWCAG(c, surface2),
            `${where} WCAG`,
          ).toBeGreaterThanOrEqual(TEXT_FLOOR.wcag);
          expect(apcaLc(c, surface2), `${where} APCA`).toBeGreaterThanOrEqual(
            TEXT_FLOOR.apca,
          );
        }
      }
    },
  );

  // The FILL co-solve, measured live on `surface-elevated` (implied a fortiori by the
  // `surface-selected` worst-case solve, #160): visible AND hosting its label.
  it.each(SCHEMES)(
    "the fill reads as UI on surface-elevated AND hosts its <status>-foreground label across themes + fallback (%s)",
    (scheme) => {
      for (const seed of SEEDS) {
        const { tokens } = resolveTheme(seed, scheme);
        const surface2 = tokens["surface-elevated"];
        for (const s of STATUS) {
          const fill = tokens[fillName(s)];
          const fillForeground = tokens[fillForegroundName(s)];
          const where = `${s}/${scheme}/${String(seed)}`;
          expect(inGamut(fill, "srgb"), `${where} fill gamut`).toBe(true);
          expect(
            contrastWCAG(fill, surface2),
            `${where} fill WCAG`,
          ).toBeGreaterThanOrEqual(FILL_FLOOR.wcag);
          expect(
            apcaLc(fill, surface2),
            `${where} fill APCA`,
          ).toBeGreaterThanOrEqual(FILL_FLOOR.apca);
          expect(
            contrastWCAG(fillForeground, fill),
            `${where} label WCAG`,
          ).toBeGreaterThanOrEqual(LABEL_FLOOR.wcag);
          expect(
            apcaLc(fillForeground, fill),
            `${where} label APCA`,
          ).toBeGreaterThanOrEqual(LABEL_FLOOR.apca);
        }
      }
    },
  );

  // subtle-foreground solved against the ACTUAL subtle-surface color (not surface-elevated) — the acceptance
  // criterion. Measured on the subtle surface that actually ships.
  it.each(SCHEMES)(
    "<status>-subtle-foreground clears its floor against the actual subtle surface across themes + fallback (%s)",
    (scheme) => {
      for (const seed of SEEDS) {
        const { tokens } = resolveTheme(seed, scheme);
        for (const s of STATUS) {
          const subtle = tokens[subtleName(s)];
          const subtleForeground = tokens[onSubtleName(s)];
          const where = `${s}-subtle-foreground/${scheme}/${String(seed)}`;
          expect(inGamut(subtle, "srgb"), `${s}-subtle ${where}`).toBe(true);
          expect(
            contrastWCAG(subtleForeground, subtle),
            `${where} WCAG`,
          ).toBeGreaterThanOrEqual(LABEL_FLOOR.wcag);
          expect(
            apcaLc(subtleForeground, subtle),
            `${where} APCA`,
          ).toBeGreaterThanOrEqual(LABEL_FLOOR.apca);
        }
      }
    },
  );

  it("garbage themeColor → isFallback true AND every status token accessible", () => {
    const { isFallback, tokens } = resolveTheme("not-a-color", "light");
    expect(isFallback).toBe(true);
    const surface2 = tokens["surface-elevated"];
    for (const s of STATUS) {
      expect(
        contrastWCAG(tokens[textName(s)], surface2),
        `${s}-text`,
      ).toBeGreaterThanOrEqual(TEXT_FLOOR.wcag);
      expect(
        contrastWCAG(tokens[fillName(s)], surface2),
        s,
      ).toBeGreaterThanOrEqual(FILL_FLOOR.wcag);
      expect(
        contrastWCAG(tokens[fillForegroundName(s)], tokens[fillName(s)]),
        `on-${s}`,
      ).toBeGreaterThanOrEqual(LABEL_FLOOR.wcag);
      expect(
        contrastWCAG(tokens[onSubtleName(s)], tokens[subtleName(s)]),
        `${s}-subtle-foreground`,
      ).toBeGreaterThanOrEqual(LABEL_FLOOR.wcag);
    }
  });

  it("is deterministic — same input → identical status tokens", () => {
    const a = resolveTheme("#3b82f6", "dark").tokens;
    const b = resolveTheme("#3b82f6", "dark").tokens;
    for (const s of STATUS)
      for (const name of allOf(s)) expect(a[name], name).toEqual(b[name]);
  });

  // Locks the accessibility promise ("any theme, both schemes, both gamuts") across a dense
  // hue × L × chroma sweep in sRGB AND P3, for text, the fill+label, and subtle-foreground.
  it(
    "every status token clears its floor across a hue/L/chroma sweep (sRGB + P3)",
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
                const surface2 = tokens["surface-elevated"];
                for (const s of STATUS) {
                  const where = `${s}/${scheme}/${gamut}/H${H}L${L}C${C}`;
                  const text = tokens[textName(s)];
                  const fill = tokens[fillName(s)];
                  const fillForeground = tokens[fillForegroundName(s)];
                  const subtle = tokens[subtleName(s)];
                  const subtleForeground = tokens[onSubtleName(s)];
                  expect(inGamut(fill, gamut), `${where} fill`).toBe(true);
                  // <status>-text on surface-elevated
                  expect(
                    contrastWCAG(text, surface2),
                    `${where} text WCAG`,
                  ).toBeGreaterThanOrEqual(TEXT_FLOOR.wcag);
                  expect(
                    apcaLc(text, surface2),
                    `${where} text APCA`,
                  ).toBeGreaterThanOrEqual(TEXT_FLOOR.apca);
                  // fill reads as UI + hosts its label
                  expect(
                    contrastWCAG(fill, surface2),
                    `${where} fill WCAG`,
                  ).toBeGreaterThanOrEqual(FILL_FLOOR.wcag);
                  expect(
                    apcaLc(fill, surface2),
                    `${where} fill APCA`,
                  ).toBeGreaterThanOrEqual(FILL_FLOOR.apca);
                  expect(
                    contrastWCAG(fillForeground, fill),
                    `${where} label WCAG`,
                  ).toBeGreaterThanOrEqual(LABEL_FLOOR.wcag);
                  expect(
                    apcaLc(fillForeground, fill),
                    `${where} label APCA`,
                  ).toBeGreaterThanOrEqual(LABEL_FLOOR.apca);
                  // subtle-foreground against the actual subtle surface
                  expect(
                    contrastWCAG(subtleForeground, subtle),
                    `${where} subtle-foreground WCAG`,
                  ).toBeGreaterThanOrEqual(LABEL_FLOOR.wcag);
                  expect(
                    apcaLc(subtleForeground, subtle),
                    `${where} subtle-foreground APCA`,
                  ).toBeGreaterThanOrEqual(LABEL_FLOOR.apca);
                }
              }
    },
    SWEEP_TIMEOUT,
  );

  // The subtle surface + subtle-foreground are pinned/solved on the SEED-INDEPENDENT status ramp, so they
  // are EXACTLY theme-invariant; `<status>-text` (solved vs the accent-tinted surface-elevated) is only
  // near-invariant. Guards against an accent-hue leak into the status solve.
  it("status subtle surfaces are theme-invariant; status text is near-invariant (fixed canonical hue)", () => {
    const a = resolveTheme("#e11d48", "light").tokens; // crimson seed
    const b = resolveTheme("#06b6d4", "light").tokens; // cyan seed
    for (const s of STATUS) {
      // Subtle + subtle-foreground: identical across themes (seed-independent ramp).
      expect(a[subtleName(s)], `${s}-subtle`).toEqual(b[subtleName(s)]);
      expect(a[onSubtleName(s)], `${s}-subtle-foreground`).toEqual(
        b[onSubtleName(s)],
      );
      // <status>-text: barely moves (surface-tint whisper only).
      expect(
        Math.abs(a[textName(s)].L - b[textName(s)].L),
        `${s}-text L`,
      ).toBeLessThan(0.02);
      expect(
        Math.abs(a[textName(s)].H - b[textName(s)].H),
        `${s}-text H`,
      ).toBeLessThan(2);
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

// The Studio's author-time `themeColor` validation (studio/schemaTypes/shared/
// colorValidation.ts) is a thin wrapper over THIS call: it accepts a value iff
// `buildTokenSet(value).meta.isFallback === false`. The Studio has no test
// runner of its own and shouldn't grow one for ~3 lines of glue; the contract that
// actually matters — "what does the engine consider usable?" — is engine behavior, so
// it's pinned here, where the runner already exists. This is the validation oracle:
// `isFallback === false` ⇔ Studio accepts. If this boundary ever moves, author-time
// validation moves with it — which is the point.
describe("themeColor validation contract (the Studio's isFallback oracle)", () => {
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

describe("baked literals clear the TRUE contrast floor (#79, 37-token contract #160, #229)", () => {
  // Each solved foreground token, the background it is solved against, and the TRUE floor
  // (no margin) it must clear. The engine solves with a small margin (`withSolveMargin`,
  // contrast.ts) so the 4-dp-rounded SHIPPED literal — not just the pre-round math — still
  // clears these floors. The worst-case surface is `surface-selected` (#160 — the darkest
  // text-bearing surface, so a pass there holds on bg/surface/surface-elevated/surface-hover too);
  // labels are solved against their ACTUAL fill/subtle-surface. Surfaces, subtle surfaces, and the
  // scrim are near-neutral fills, not contrast-solved foregrounds — no floor of their own.
  const CONTRACT: Record<
    string,
    { bg: ThemeTokenName; wcag: number; apca: number }
  > = {
    // Neutral + accent foregrounds — solved against the worst-case surface.
    foreground: { bg: "surface-selected", wcag: 4.5, apca: 75 },
    "muted-foreground": { bg: "surface-selected", wcag: 4.5, apca: 60 },
    border: { bg: "surface-selected", wcag: 3, apca: 30 },
    "accent-text": { bg: "surface-selected", wcag: 4.5, apca: 60 },
    ring: { bg: "surface-selected", wcag: 3, apca: 45 },
    // Fills read as UI on the surface (3:1 / Lc 45); their labels sit on the fill (4.5 / Lc 60).
    accent: { bg: "surface-selected", wcag: 3, apca: 45 },
    "accent-hover": { bg: "surface-selected", wcag: 3, apca: 45 },
    "accent-foreground": { bg: "accent", wcag: 4.5, apca: 60 },
    // Accent subtle: the subtle-foreground label solved against its ACTUAL subtle-surface color.
    "accent-subtle-foreground": { bg: "accent-subtle", wcag: 4.5, apca: 60 },
    // Status TRIOS: fill (UI) · fill-foreground (label on fill) · text (accent-text tier on surface).
    error: { bg: "surface-selected", wcag: 3, apca: 45 },
    "error-foreground": { bg: "error", wcag: 4.5, apca: 60 },
    "error-text": { bg: "surface-selected", wcag: 4.5, apca: 60 },
    warning: { bg: "surface-selected", wcag: 3, apca: 45 },
    "warning-foreground": { bg: "warning", wcag: 4.5, apca: 60 },
    "warning-text": { bg: "surface-selected", wcag: 4.5, apca: 60 },
    success: { bg: "surface-selected", wcag: 3, apca: 45 },
    "success-foreground": { bg: "success", wcag: 4.5, apca: 60 },
    "success-text": { bg: "surface-selected", wcag: 4.5, apca: 60 },
    info: { bg: "surface-selected", wcag: 3, apca: 45 },
    "info-foreground": { bg: "info", wcag: 4.5, apca: 60 },
    "info-text": { bg: "surface-selected", wcag: 4.5, apca: 60 },
    // Status SUBTLES: the subtle-foreground label solved against its ACTUAL subtle-surface color.
    "error-subtle-foreground": { bg: "error-subtle", wcag: 4.5, apca: 60 },
    "warning-subtle-foreground": { bg: "warning-subtle", wcag: 4.5, apca: 60 },
    "success-subtle-foreground": { bg: "success-subtle", wcag: 4.5, apca: 60 },
    "info-subtle-foreground": { bg: "info-subtle", wcag: 4.5, apca: 60 },
  };
  // Round-trip a token through the exact bake path (formatOklch → parseColor) to measure
  // what actually ships, not the precise solver output.
  const bake = (c: OkLCH): OkLCH => parseColor(formatOklch(c))!;
  // A generated hue × L × chroma sweep, NOT a handful of fixed seeds — the accent fill /
  // accent-foreground path solves on a discrete-L scan whose floor-hugging edge only shows under a
  // real sweep (a fixed-seed list silently misses it). Plus QA's exact accent-path edge
  // seeds and the fallback.
  const SEEDS: unknown[] = [
    ...[0, 45, 90, 130, 150, 200, 238, 278, 320].flatMap((H) =>
      [0.4, 0.6, 0.82].flatMap((L) =>
        [0.15, 0.28].map((C) => `oklch(${L} ${C} ${H})`),
      ),
    ),
    "oklch(0.6 0.28 150)", // QA B1 edge: baked accent-foreground hit 4.4998 pre-fix
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
              const fg = bake(tokens[name as ThemeTokenName]);
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
            // #160: the accent co-solve constraint CARRIES onto its hover — the SAME accent-foreground
            // label must still clear its floor on the nudged `accent-hover` fill.
            const accentForeground = bake(tokens["accent-foreground"]);
            const hover = bake(tokens["accent-hover"]);
            const w = `accent-foreground/accent-hover/${scheme}/${gamut}/${String(seed)}`;
            expect(
              contrastWCAG(accentForeground, hover),
              `${w} WCAG`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
              apcaLc(accentForeground, hover),
              `${w} APCA`,
            ).toBeGreaterThanOrEqual(60);
          }
    },
    SWEEP_TIMEOUT,
  );
});

describe("QA — adversarial: #153 accent-foreground C→0 limit at the chroma-backoff BOUNDARY", () => {
  // #153 acceptance: "Achromatic-seed output identical to today (C→0 limit)." The existing
  // suite proves this at EXACTLY C=0 (#808080). The strict-generalization guarantee lives in
  // `chromaticOnAccentLabel`'s `chroma <= CHROMA_BACKOFF_EPS` (1e-4) short-circuit — so the
  // real boundary is a seed whose (per-scheme-dampened) chroma sits AT or just below that eps,
  // not zero. A regression that widened the eps, or dropped the short-circuit, would emit a
  // faintly-tinted label here instead of the achromatic extreme; a fixed C=0 test can't see it.
  it("a seed at/just-below the chroma-backoff eps still ships a purely achromatic label", () => {
    for (const C of [0, 0.00005, 0.0001]) {
      for (const L of [0.25, 0.5, 0.75]) {
        const seed = `oklch(${L} ${C} 137)`;
        for (const scheme of SCHEMES) {
          const { tokens } = resolveTheme(seed, scheme);
          // The label carries NO chroma — bit-for-bit the near-white/near-black extreme.
          expect(tokens["accent-foreground"].C, `${seed}/${scheme}`).toBe(0);
        }
      }
    }
  });

  it("tintedNeutrals:false does not perturb the achromatic accent-foreground label (still C=0)", () => {
    for (const scheme of SCHEMES) {
      const { tokens } = resolveTheme("#808080", scheme, {
        rules: { tintedNeutrals: false },
      });
      expect(tokens["accent-foreground"].C, scheme).toBe(0);
    }
  });
});

describe("seed anchor-step (#108)", () => {
  it("the accent ramp's anchored step IS the seed's exact color (light-native seed)", () => {
    const result = resolveTheme("#2563eb", "light");
    expect(result.direction).toBe("light");
    expect(result.anchorLabel).toBe("500");
    const anchored = result.ramps.accent.find(
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
    const anchored = result.ramps.accent.find((s) => s.label === "300")!;
    expect(anchored.color.L).toBeCloseTo(result.seed.L, 9);
  });

  it("anchors the accent ramp in BOTH schemes at the same label", () => {
    for (const scheme of ["light", "dark"] as const) {
      const result = resolveTheme("#dc2626", scheme);
      const anchored = result.ramps.accent.find(
        (s) => s.label === result.anchorLabel,
      )!;
      // Same L in both schemes (only chroma dampens in dark).
      expect(anchored.color.L).toBeCloseTo(result.seed.L, 9);
    }
  });

  it("only the accent ramp is anchored — neutral/status stay on the shared scale", () => {
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
    // …while the accent ramps genuinely differ at their anchored steps.
    const stepOf = (r: typeof a, label: string) =>
      r.ramps.accent.find((s) => s.label === label)!;
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
      const anchored = result.ramps.accent.find(
        (s) => s.label === result.anchorLabel,
      )!;
      expect(result.tokens.accent).toEqual(anchored.color);
    }
  });

  it("anchoring holds across seed lightnesses (harness-style sweep)", () => {
    for (const hex of ["#1e3a8a", "#dc2626", "#16a34a", "#eab308", "#06b6d4"]) {
      for (const scheme of ["light", "dark"] as const) {
        const result = resolveTheme(hex, scheme);
        const anchored = result.ramps.accent.find(
          (s) => s.label === result.anchorLabel,
        )!;
        expect(anchored.color.L).toBeCloseTo(result.seed.L, 9);
        // The bent ramp stays strictly monotonic.
        for (let i = 1; i < result.ramps.accent.length; i++) {
          expect(result.ramps.accent[i].color.L).toBeLessThan(
            result.ramps.accent[i - 1].color.L,
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
      // bg/surface/surface-elevated bind pinned shoulder steps — identical under every distribution.
      // (surface-hover/surface-selected pin interior steps and DO move with the distribution,
      // #160; the AA guarantee still holds because foregrounds solve against surface-selected's
      // ACTUAL per-policy step, not an assumed one.)
      expect(ruled.tokens.background).toEqual(plain.tokens.background);
      expect(ruled.tokens.surface).toEqual(plain.tokens.surface);
      expect(ruled.tokens["surface-elevated"]).toEqual(
        plain.tokens["surface-elevated"],
      );
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
      // Foreground token, the background it is solved against, and its schema target
      // (palette.ts CONTRAST_TARGETS): fills read as UI (3:1/Lc45) on the worst-case surface
      // `surface-selected` (#160); labels sit on their actual fill/subtle-surface (4.5/Lc60).
      const FLOORS: Array<[ThemeTokenName, ThemeTokenName, number, number]> = [
        ["foreground", "surface-selected", 4.5, 75],
        ["muted-foreground", "surface-selected", 4.5, 60],
        ["border", "surface-selected", 3, 30],
        ["accent-text", "surface-selected", 4.5, 60],
        ["ring", "surface-selected", 3, 45],
        ["accent", "surface-selected", 3, 45],
        ["accent-hover", "surface-selected", 3, 45],
        ["accent-foreground", "accent", 4.5, 60],
        ["error", "surface-selected", 3, 45],
        ["error-foreground", "error", 4.5, 60],
        ["error-text", "surface-selected", 4.5, 60],
        ["error-subtle-foreground", "error-subtle", 4.5, 60],
        ["warning", "surface-selected", 3, 45],
        ["warning-foreground", "warning", 4.5, 60],
        ["warning-text", "surface-selected", 4.5, 60],
        ["warning-subtle-foreground", "warning-subtle", 4.5, 60],
        ["success", "surface-selected", 3, 45],
        ["success-foreground", "success", 4.5, 60],
        ["success-text", "surface-selected", 4.5, 60],
        ["success-subtle-foreground", "success-subtle", 4.5, 60],
        ["info", "surface-selected", 3, 45],
        ["info-foreground", "info", 4.5, 60],
        ["info-text", "surface-selected", 4.5, 60],
        ["info-subtle-foreground", "info-subtle", 4.5, 60],
        // #229 (QA): the two new PAIRED floors. `accent-subtle-foreground` sits on the
        // ANCHORED accent ramp (unlike the un-anchored status ramps), so a policy that
        // reshapes/desaturates the accent ramp is exactly where this pair could break first.
        ["accent-subtle-foreground", "accent-subtle", 4.5, 60],
        ["muted-foreground", "muted", 4.5, 60],
      ];
      for (const rules of VARIATIONS)
        for (const seed of ["#2563eb", "#eab308", "#06b6d4"])
          for (const scheme of SCHEMES) {
            const { tokens } = resolveTheme(seed, scheme, { rules });
            for (const [name, bgName, wcag, apca] of FLOORS) {
              const label = `${name} ${JSON.stringify(rules)} ${seed}/${scheme}`;
              const bg = tokens[bgName];
              expect(
                contrastWCAG(tokens[name], bg),
                label,
              ).toBeGreaterThanOrEqual(wcag);
              expect(apcaLc(tokens[name], bg), label).toBeGreaterThanOrEqual(
                apca,
              );
            }
            // #160: accent-foreground's guarantee carries onto the nudged accent-hover fill too.
            expect(
              contrastWCAG(tokens["accent-foreground"], tokens["accent-hover"]),
              `accent-foreground/hover ${JSON.stringify(rules)} ${seed}/${scheme}`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
              apcaLc(tokens["accent-foreground"], tokens["accent-hover"]),
              `accent-foreground/hover ${JSON.stringify(rules)} ${seed}/${scheme}`,
            ).toBeGreaterThanOrEqual(60);
          }
    },
    SWEEP_TIMEOUT,
  );
});

// QA #108 — the boundaries the committed suite optimized past: extreme-lightness seeds
// (white/black/out-of-gamut-L), the "exact L IS the seed's" claim under the clamp, and the
// over-general "accent lands exactly on the anchored step" claim (committed test asserts it
// from three delta-0 fixtures; it does NOT hold for a mid-tone seed).
describe("seed anchor-step (#108) — QA edge hardening", () => {
  const bake = (c: OkLCH): OkLCH => parseColor(formatOklch(c))!;
  const AA: Record<string, { bg: ThemeTokenName; wcag: number; apca: number }> =
    {
      foreground: { bg: "surface-selected", wcag: 4.5, apca: 75 },
      "muted-foreground": { bg: "surface-selected", wcag: 4.5, apca: 60 },
      border: { bg: "surface-selected", wcag: 3, apca: 30 },
      "accent-text": { bg: "surface-selected", wcag: 4.5, apca: 60 },
      ring: { bg: "surface-selected", wcag: 3, apca: 45 },
      accent: { bg: "surface-selected", wcag: 3, apca: 45 },
      "accent-foreground": { bg: "accent", wcag: 4.5, apca: 60 },
    };

  // The committed AA sweep only spans seed L ∈ [0.4, 0.82]. The bend + the anchor clamp
  // both bite hardest at the extremes — where the anchored accent step (which accent-text /
  // ring bind through) is clamped, not the seed's L. Prove the AA guarantee survives.
  it(
    "every foreground token still clears its floor for extreme-L seeds (incl. #fff / #000)",
    () => {
      const seeds: unknown[] = ["#ffffff", "#000000", "#fefefe", "#010101"];
      for (const H of [0, 60, 145, 200, 260, 320])
        for (const L of [0.03, 0.08, 0.12, 0.15, 0.92, 0.95, 0.98, 1.0])
          for (const C of [0.05, 0.2]) seeds.push(`oklch(${L} ${C} ${H})`);

      for (const scheme of SCHEMES)
        for (const seed of seeds) {
          const { tokens } = resolveTheme(seed, scheme);
          for (const [name, c] of Object.entries(AA)) {
            const fg = bake(tokens[name as ThemeTokenName]);
            const bg = bake(tokens[c.bg]);
            const where = `${name}/${scheme}/${String(seed)}`;
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

  // Honesty check on the "the anchored step's L IS the seed's" contract (types.ts / README):
  // for a seed outside the ramp's open interval the step is CLAMPED, so it is NOT the seed's
  // exact L. White anchors dark-native `300` at 0.98 (seed L ≈ 1); black anchors light-native
  // `500` at 0.15 (seed L ≈ 0). The docs state the equality unconditionally — this pins the
  // real, clamped behavior so the caveat is explicit and testable.
  it("clamps the anchored step for out-of-scale seeds — NOT the seed's exact L (#fff / #000)", () => {
    const white = resolveTheme("#ffffff", "dark"); // white → dark-native
    expect(white.anchorLabel).toBe("300");
    const wStep = white.ramps.accent.find((s) => s.label === "300")!;
    expect(white.seed.L).toBeGreaterThan(0.98); // seed is lighter than the clamp
    expect(wStep.color.L).toBeCloseTo(0.98, 4); // …but the step is clamped to it
    expect(wStep.color.L).not.toBeCloseTo(white.seed.L, 4); // so NOT the seed's exact L

    const black = resolveTheme("#000000", "light"); // black → light-native
    expect(black.anchorLabel).toBe("500");
    const bStep = black.ramps.accent.find((s) => s.label === "500")!;
    expect(black.seed.L).toBeLessThan(0.15);
    expect(bStep.color.L).toBeCloseTo(0.15, 4);
    expect(bStep.color.L).not.toBeCloseTo(black.seed.L, 4);
  });

  it("agrees on anchorLabel across both schemes and buildTokenSet.meta for extreme seeds", () => {
    for (const seed of ["#ffffff", "#000000", "oklch(0.98 0.02 200)"]) {
      const light = resolveTheme(seed, "light");
      const dark = resolveTheme(seed, "dark");
      const meta = buildTokenSet(seed).meta.anchorLabel;
      expect(light.anchorLabel).toBe(dark.anchorLabel); // direction is seed-only
      expect(meta).toBe(light.anchorLabel);
    }
  });

  // Counter-example to the committed "the NATIVE-scheme accent lands exactly on the anchored
  // ramp step" test, which only samples three delta-0 fixtures. The equality is NOT general:
  // a mid-tone native seed that cannot host a legible accent-foreground label at its own L makes
  // `solveNativeAccent` nudge L away from mid (by design) — so the accent FILL diverges from
  // the anchored step, while the anchored STEP itself still equals seed.L. This pins the true,
  // conditional contract so nobody builds on a false "accent ≡ anchored step" invariant.
  it("native accent DIVERGES from the anchored step for a mid-tone seed (equality is NOT general)", () => {
    const seed = "oklch(0.65 0.15 0)"; // dark-native mid red — needs a delta nudge
    const direction = resolveTheme(seed, "light").direction;
    const r = resolveTheme(seed, direction);
    const anchored = r.ramps.accent.find((s) => s.label === r.anchorLabel)!;

    // The anchored STEP faithfully holds the seed's L…
    expect(anchored.color.L).toBeCloseTo(r.seed.L, 6);
    // …but the accent FILL is co-solved elsewhere for accent-foreground legibility — they differ.
    expect(Math.abs(anchored.color.L - r.tokens.accent.L)).toBeGreaterThan(
      0.05,
    );
  });
});

describe("QA — adversarial: interaction-state + un-mirror invariants (#160)", () => {
  const SURFACES = [
    "background",
    "surface",
    "surface-elevated",
    "surface-hover",
    "surface-selected",
  ] as const;

  // #160 acceptance: "accent-hover — perceptibly distinct from accent (both schemes)". The
  // solver's own HOVER_DELTA_L (accent.ts) documents ~0.05 L as the minimum perceptible
  // nudge; at the lightness extremes clamp01 can eat it (pure black can't get darker), so
  // the solver rejects clamp-pinned candidates and takes the direction that has room — an
  // extreme seed still gets a visible hover state.
  it("accent-hover stays perceptibly distinct from accent at extreme seeds", () => {
    const PERCEPTIBLE = 0.02; // conservative floor, well under the documented 0.05 nudge
    const cases = [
      ["#000000", "light"],
      ["#ffffff", "dark"],
      ["#fefefe", "dark"],
    ] as const;
    for (const [seed, scheme] of cases) {
      const { tokens } = resolveTheme(seed, scheme);
      expect(
        Math.abs(tokens["accent-hover"].L - tokens.accent.L),
        `${seed}/${scheme}`,
      ).toBeGreaterThanOrEqual(PERCEPTIBLE);
    }
  });

  // The "clears on EVERY surface" guarantee is proven transitively (every foreground solves
  // against `surface-selected`, the worst case). Lock it empirically: each solved foreground
  // clears its floor on ALL FIVE surfaces — bg, surface, surface-elevated and the two #160 state
  // surfaces — in both schemes and both gamuts, incl. the yellow/cyan stressers + fallback.
  const FG_FLOORS: Array<[ThemeTokenName, number, number]> = [
    ["foreground", 4.5, 75],
    ["muted-foreground", 4.5, 60],
    // Neutral graphic ink — the `ui` tier, WCAG 2.2 SC 1.4.11 non-text 3:1. This table is
    // hand-enumerated, so a role added to the engine without a row here is silently UNTESTED.
    ["icon", 3, 45],
    ["border", 3, 30],
    ["accent-text", 4.5, 60],
    ["ring", 3, 45],
    ["accent", 3, 45],
    ["accent-hover", 3, 45],
    ["error", 3, 45],
    ["error-text", 4.5, 60],
    ["warning", 3, 45],
    ["warning-text", 4.5, 60],
    ["success", 3, 45],
    ["success-text", 4.5, 60],
    ["info", 3, 45],
    ["info-text", 4.5, 60],
  ];

  it("FG_FLOORS covers EVERY surface-solved role — a new role cannot go untested", () => {
    // The table above is hand-written, so adding an engine role without a row here leaves it
    // with zero contrast coverage while the whole suite stays green (exactly how `icon` was
    // introduced). Derive the expected set from the binding schema instead: `auto` (solved
    // against the worst surface), `fill` and `fill-hover` (solved as UI on the surface) are
    // precisely the roles this sweep owns. `auto-on` / `fill-foreground` labels solve against
    // their OWN fill, not the five surfaces — they have their own tests — and `step` surfaces
    // and the `literal` scrim are not solved at all.
    const surfaceSolved = Object.entries(DEFAULT_BINDING_SCHEMA)
      .filter(([, binding]) =>
        ["auto", "fill", "fill-hover"].includes(binding.kind),
      )
      .map(([name]) => name)
      .sort();
    expect(FG_FLOORS.map(([name]) => name).sort()).toEqual(surfaceSolved);
  });

  it(
    "every solved foreground clears its floor on ALL FIVE surfaces (schemes × gamuts)",
    () => {
      const seeds = [
        "#3b82f6",
        "#eab308", // yellow stresser
        "#06b6d4", // cyan stresser
        "oklch(0.55 0.35 330)",
        "garbage", // → fallback
      ];
      for (const gamut of ["srgb", "p3"] as const)
        for (const scheme of SCHEMES)
          for (const seed of seeds) {
            const { tokens } = resolveTheme(seed, scheme, { gamut });
            for (const [name, wcag, apca] of FG_FLOORS)
              for (const s of SURFACES) {
                const where = `${name} on ${s} ${scheme}/${gamut}/${seed}`;
                expect(
                  contrastWCAG(tokens[name], tokens[s]),
                  `${where} WCAG`,
                ).toBeGreaterThanOrEqual(wcag);
                expect(
                  apcaLc(tokens[name], tokens[s]),
                  `${where} APCA`,
                ).toBeGreaterThanOrEqual(apca);
              }
          }
    },
    SWEEP_TIMEOUT,
  );

  it("the five surfaces are strictly ordered by lightness (pairwise distinct), per scheme", () => {
    for (const scheme of SCHEMES)
      for (const seed of ["#3b82f6", "#eab308", "garbage"])
        for (const tintedNeutrals of [true, false]) {
          const { tokens } = resolveTheme(seed, scheme, {
            rules: { tintedNeutrals },
          });
          const Ls = SURFACES.map((s) => tokens[s].L);
          for (let i = 1; i < Ls.length; i++) {
            const where = `${SURFACES[i]} ${scheme}/${seed}/tinted:${tintedNeutrals}`;
            // Light: bg is lightest, each state surface strictly darker; dark mirrors ROLES.
            if (scheme === "light")
              expect(Ls[i], where).toBeLessThan(Ls[i - 1]);
            else expect(Ls[i], where).toBeGreaterThan(Ls[i - 1]);
          }
        }
  });

  // The neutral ramp (which text/muted-foreground/border bind to) depends only on the seed's HUE
  // and tintedNeutrals — so a hue sweep at both settings covers the whole input domain.
  it(
    "text / muted-foreground / border are pairwise-distinct colors in each scheme (hue sweep)",
    () => {
      for (const scheme of SCHEMES)
        for (let H = 0; H < 360; H += 30)
          for (const tintedNeutrals of [true, false]) {
            const { tokens } = resolveTheme(`oklch(0.55 0.2 ${H})`, scheme, {
              rules: { tintedNeutrals },
            });
            const fgs = [
              tokens.foreground,
              tokens["muted-foreground"],
              tokens.border,
            ];
            const names = ["foreground", "muted-foreground", "border"];
            for (let i = 0; i < fgs.length; i++)
              for (let j = i + 1; j < fgs.length; j++)
                expect(
                  sameColor(fgs[i], fgs[j]),
                  `${names[i]}≡${names[j]} H${H} ${scheme} tinted:${tintedNeutrals}`,
                ).toBe(false);
          }
    },
    SWEEP_TIMEOUT,
  );

  it("dark is generated on its OWN scale — not a mirror-label flip of light (#160)", () => {
    const light = resolveTheme("#3b82f6", "light");
    const dark = resolveTheme("#3b82f6", "dark");
    const lightLs = light.ramps.neutral.map((s) => s.color.L);
    const darkLs = dark.ramps.neutral.map((s) => s.color.L);
    // A mirror-label flip would make dark's scale the reverse of light's. It is not.
    expect(darkLs).not.toEqual([...lightLs].reverse());
    // Dark's bg (step 950) carries dark's OWN value, not light's 950 read upside down.
    expect(
      Math.abs(dark.tokens.background.L - lightLs[lightLs.length - 1]),
    ).toBeGreaterThan(0.01);
    // Each scheme carries its own neutral chroma (light 0.04, dark 0.045) — read at a mid
    // step, far from the gamut boundary, where the nominal chroma survives the map.
    const midLight = light.ramps.neutral.find((s) => s.label === "600")!;
    const midDark = dark.ramps.neutral.find((s) => s.label === "300")!;
    expect(midLight.color.C).toBeCloseTo(0.04, 3);
    expect(midDark.color.C).toBeCloseTo(0.045, 3);
  });

  it("scrim is a seed-independent translucent literal in BOTH schemes (alpha 0.6)", () => {
    for (const seed of ["#3b82f6", "#000000", "garbage"]) {
      const set = buildTokenSet(seed);
      for (const scheme of SCHEMES) {
        const scrim = set.tokens.scrim[scheme];
        expect(scrim.alpha, `${seed}/${scheme}`).toBeCloseTo(0.6, 5);
        expect(scrim.L, `${seed}/${scheme}`).toBeLessThan(0.2); // dims toward black
        expect(scrim.C, `${seed}/${scheme}`).toBe(0);
        expect(set.meta.bindings.scrim[scheme]).toEqual({
          kind: "literal",
          alpha: 0.6,
        });
      }
    }
  });
});

describe("QA — adversarial: hostile themeColor inputs (never-throws, #160)", () => {
  it("non-string exotics fall back without throwing", () => {
    const inputs: unknown[] = [
      {},
      [],
      true,
      0.5,
      -1,
      Symbol("x"),
      () => {},
      new String("#ff0000"), // a String OBJECT is not a string primitive
      { toString: () => "#ff0000" },
    ];
    for (const input of inputs) {
      const set = buildTokenSet(input);
      expect(set.meta.isFallback).toBe(true);
      expect(Number.isFinite(set.tokens.foreground.light.L)).toBe(true);
    }
  });

  it.each([
    "oklch(-0.5 0.1 30)", // negative L — the parser's regex rejects it
    "oklch(1e5 0.1 30)", // exponent form — rejected, never NaN
    "rgb(-5, 0, 0)", // negative channel — rejected
  ])("rejects %j to the fallback palette without throwing", (input) => {
    expect(buildTokenSet(input).meta.isFallback).toBe(true);
  });

  it("clamps parseable numeric extremes instead of falling back", () => {
    // L clamps into [0,1], C floors at 0, H normalizes mod 360 — then the gamut map
    // absorbs the huge chroma. Parseable-but-wild input is themed, not rejected.
    const set = buildTokenSet("oklch(99 99 99999)");
    expect(set.meta.isFallback).toBe(false);
    expect(Number.isFinite(set.tokens.accent.light.L)).toBe(true);
    expect(inGamut(set.tokens.accent.light, "srgb")).toBe(true);
  });

  it("a pathologically long string falls back without throwing", () => {
    expect(buildTokenSet("a".repeat(100_000)).meta.isFallback).toBe(true);
  });
});

// QA #229 — adversarial: the muted + accent-subtle pair. The committed CONTRACT sweep covers
// `accent-subtle-foreground` on a mid-range seed grid (L 0.4–0.82, C 0.15/0.28) — it never
// visits an achromatic seed, a near-white/near-black seed, or `tintedNeutrals: false`, and
// `--muted` ships with NO test pairing it against `muted-foreground` at all (the pairing held
// only transitively, through `muted` ≡ `surface` — exactly the identity a future step change
// would break silently). These pin the pairing guarantees directly, on the BAKED literals.
describe("QA #229 — adversarial: muted + accent-subtle pairing guarantees", () => {
  const bake = (c: OkLCH): OkLCH => parseColor(formatOklch(c))!;
  const PAIR_FLOOR = { wcag: 4.5, apca: 60 } as const;
  // Hostile corners first: achromatic (C=0), near-white, near-black, the too-light
  // dark-native seed, the yellow/cyan APCA stressers, and the fallback.
  const HOSTILE_SEEDS: unknown[] = [
    "#808080",
    "#ffffff",
    "#000000",
    "#faf3c0",
    "#eab308",
    "#06b6d4",
    "#3b82f6",
    "garbage",
  ];
  const GAMUTS = ["srgb", "p3"] as const;

  it("muted binds the neutral 100/900 step — and (by design, #229) equals surface today", () => {
    for (const scheme of SCHEMES) {
      const { tokens, ramps } = resolveTheme("#3b82f6", scheme);
      const label = scheme === "light" ? "100" : "900";
      const step = ramps.neutral.find((s) => s.label === label)!;
      expect(tokens.muted, scheme).toEqual(step.color);
      // The documented intent: same fallback color as `surface`, distinct role. If this
      // ever fails, `muted` moved off the surface step — re-verify the pairing floors.
      expect(tokens.muted, scheme).toEqual(tokens.surface);
    }
  });

  it("accent-subtle binds the accent ramp's SUBTLE_STEP (100/900), mirroring the status subtles", () => {
    for (const seed of ["#3b82f6", "#e11d48", "#808080"])
      for (const scheme of SCHEMES) {
        const { tokens, ramps } = resolveTheme(seed, scheme);
        const label = scheme === "light" ? "100" : "900";
        const step = ramps.accent.find((s) => s.label === label)!;
        expect(tokens["accent-subtle"], `${seed}/${scheme}`).toEqual(
          step.color,
        );
      }
  });

  it(
    "muted-foreground clears its floor against the ACTUAL baked muted background (hostile seeds × schemes × gamuts)",
    () => {
      for (const gamut of GAMUTS)
        for (const scheme of SCHEMES)
          for (const seed of HOSTILE_SEEDS) {
            const { tokens } = resolveTheme(seed, scheme, { gamut });
            const fg = bake(tokens["muted-foreground"]);
            const bg = bake(tokens.muted);
            const where = `muted-foreground/${scheme}/${gamut}/${String(seed)}`;
            expect(
              contrastWCAG(fg, bg),
              `${where} WCAG`,
            ).toBeGreaterThanOrEqual(PAIR_FLOOR.wcag);
            expect(apcaLc(fg, bg), `${where} APCA`).toBeGreaterThanOrEqual(
              PAIR_FLOOR.apca,
            );
          }
    },
    SWEEP_TIMEOUT,
  );

  it(
    "accent-subtle-foreground clears its floor against the ACTUAL baked accent-subtle (hostile seeds × schemes × gamuts)",
    () => {
      for (const gamut of GAMUTS)
        for (const scheme of SCHEMES)
          for (const seed of HOSTILE_SEEDS) {
            const { tokens } = resolveTheme(seed, scheme, { gamut });
            const fg = bake(tokens["accent-subtle-foreground"]);
            const bg = bake(tokens["accent-subtle"]);
            const where = `accent-subtle-foreground/${scheme}/${gamut}/${String(seed)}`;
            expect(
              contrastWCAG(fg, bg),
              `${where} WCAG`,
            ).toBeGreaterThanOrEqual(PAIR_FLOOR.wcag);
            expect(apcaLc(fg, bg), `${where} APCA`).toBeGreaterThanOrEqual(
              PAIR_FLOOR.apca,
            );
          }
    },
    SWEEP_TIMEOUT,
  );

  it(
    "both pairs hold at the seed-L extremes where the accent-ramp anchor bend bites hardest",
    () => {
      // The anchor clamps a near-white/near-black seed just inside ~0.15…0.98 and bends the
      // accent ramp around it — compressing the very shoulder steps `accent-subtle` pins.
      const seeds: string[] = [];
      for (const H of [0, 80, 145, 264, 330])
        for (const L of [0.03, 0.15, 0.5, 0.98, 1.0])
          seeds.push(`oklch(${L} 0.2 ${H})`);
      for (const scheme of SCHEMES)
        for (const seed of seeds) {
          const { tokens } = resolveTheme(seed, scheme);
          for (const [fgName, bgName] of [
            ["accent-subtle-foreground", "accent-subtle"],
            ["muted-foreground", "muted"],
          ] as const) {
            const fg = bake(tokens[fgName]);
            const bg = bake(tokens[bgName]);
            const where = `${fgName}/${scheme}/${seed}`;
            expect(
              contrastWCAG(fg, bg),
              `${where} WCAG`,
            ).toBeGreaterThanOrEqual(PAIR_FLOOR.wcag);
            expect(apcaLc(fg, bg), `${where} APCA`).toBeGreaterThanOrEqual(
              PAIR_FLOOR.apca,
            );
          }
        }
    },
    SWEEP_TIMEOUT,
  );

  it("tintedNeutrals:false (converged grey ramps) keeps both pairings legible", () => {
    for (const seed of ["#808080", "#3b82f6", "#000000"])
      for (const scheme of SCHEMES) {
        const { tokens } = resolveTheme(seed, scheme, {
          rules: { tintedNeutrals: false },
        });
        for (const [fgName, bgName] of [
          ["accent-subtle-foreground", "accent-subtle"],
          ["muted-foreground", "muted"],
        ] as const) {
          const where = `${fgName}/${scheme}/${seed}/untinted`;
          expect(
            contrastWCAG(bake(tokens[fgName]), bake(tokens[bgName])),
            `${where} WCAG`,
          ).toBeGreaterThanOrEqual(PAIR_FLOOR.wcag);
          expect(
            apcaLc(bake(tokens[fgName]), bake(tokens[bgName])),
            `${where} APCA`,
          ).toBeGreaterThanOrEqual(PAIR_FLOOR.apca);
        }
      }
  });
});
