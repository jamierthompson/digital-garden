import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  apcaLc,
  clamp01,
  contrastWCAG,
  oklchToSrgb,
  parseColor,
  srgbToOklch,
} from "@garden/oklch";

import { cardSwatches, type CardSwatchVar } from "./cardSwatches";

/** A baked `light-dark(oklch(…), oklch(…))` literal — no runtime color math. */
const LIGHT_DARK = /^light-dark\(oklch\([^)]+\), oklch\([^)]+\)\)$/;

/** The generic semantic tokens a card re-binds — the #57 no-prefix contract. */
const KEYS = [
  "--surface",
  "--foreground",
  "--border",
  "--accent",
  "--accent-foreground",
] as const;

describe("cardSwatches — valid themeColor", () => {
  const style = cardSwatches("#3b82f6");

  it("emits exactly the four generic semantic-token overrides", () => {
    expect(Object.keys(style).sort()).toEqual([...KEYS].sort());
  });

  it("uses only generic semantic names — no slug-prefixed token leaks (#57)", () => {
    // Every key is a bare semantic role name; none is namespaced (`--c-*`, `--theme-*`, `--<proj>-*`).
    for (const key of Object.keys(style)) {
      expect(key).toMatch(
        /^--(?:surface|foreground|border|accent|accent-foreground)$/,
      );
    }
  });

  it("bakes every token as a light-dark() of oklch() literals", () => {
    for (const key of KEYS) {
      expect(style[key]).toMatch(LIGHT_DARK);
    }
  });

  it("returns plain inline-style data — no <style>, selector, or class", () => {
    for (const value of Object.values(style)) {
      expect(value).not.toContain("<style");
      expect(value).not.toContain("@layer");
      expect(value).not.toContain("{");
      expect(value).not.toContain("}");
      expect(value).not.toContain("[data-");
    }
  });

  it("tracks the theme color — a different seed yields a different palette", () => {
    const other = cardSwatches("#ef4444");
    // At least the accent must differ; in practice surface/text/border shift too.
    expect(style["--accent"]).not.toBe(other["--accent"]);
  });

  it("surface and text are distinct — the solved contrast pair, not one flat color", () => {
    expect(style["--surface"]).not.toBe(style["--foreground"]);
  });

  it("accepts the engine gamut option without throwing", () => {
    expect(() => cardSwatches("#3b82f6", { gamut: "p3" })).not.toThrow();
  });
});

describe("cardSwatches — defensive & total", () => {
  // Bad / missing / hostile inputs all flow through the engine's fallback palette.
  const hostile: [string, unknown][] = [
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["boolean", true],
    ["empty string", ""],
    ["garbage string", "not-a-color"],
    ["object", { themeColor: "#fff" }],
    ["array", ["#fff"]],
    ["injection-y string", '#fff"}</style><script>alert(1)</script>'],
    ["css-breakout string", "red; } body { display: none"],
  ];

  it.each(hostile)("never throws on %s", (_label, input) => {
    expect(() => cardSwatches(input)).not.toThrow();
  });

  it.each(hostile)("returns a full valid palette for %s", (_label, input) => {
    const style = cardSwatches(input);
    for (const key of KEYS) {
      expect(style[key]).toMatch(LIGHT_DARK);
    }
  });

  it("a hostile string cannot inject markup into any value", () => {
    const style = cardSwatches('#fff"}</style><script>alert(1)</script>');
    for (const value of Object.values(style)) {
      expect(value).toMatch(LIGHT_DARK);
      expect(value).not.toContain("<");
      expect(value).not.toContain("script");
    }
  });

  it("falls back deterministically — same bad input yields the same style", () => {
    expect(cardSwatches(null)).toEqual(cardSwatches(undefined));
  });
});

/**
 * Engine contrast STRESS-TEST, via the featured-home card consumer.
 *
 * The featured-home grid exists to exercise the engine: a card's SURFACE and TEXT are both
 * engine-derived from its `themeColor`, so the ratio between them IS the solver's output.
 * This suite feeds `cardSwatches` a battery of edge-case theme colors — the hard paths the
 * solver must survive (too-light, yellow/cyan where a uniform ΔL fails, high-chroma /
 * wide-gamut, near-black) — parses the BAKED colors back out of each card's `light-dark()`
 * literals, and asserts:
 *   • text on surface clears WCAG 2.2 AA body contrast (≥ 4.5:1), and
 *   • the border + accent clear the non-text UI floor (≥ 3:1) on that same surface,
 * in BOTH schemes and BOTH gamuts. If any theme value drops a pair under its floor, this
 * goes red — a real engine finding surfaced at the exact place the grid is meant to prove it.
 *
 * (The engine solves foregrounds against the worst-case surface `surface-2`, so a pass here
 * on `surface` is the guaranteed-minimum; see `packages/oklch/src/palette.ts`.)
 */
describe("cardSwatches — the engine solves an accessible card palette across theme values", () => {
  // [label, themeColor] — chosen to hit the solver's documented hard paths.
  const SEEDS: readonly [string, string][] = [
    ["mid blue", "#3b82f6"],
    ["mid red", "#ef4444"],
    ["violet", "#8b5cf6"],
    ["goldenrod (yellow)", "#d4a017"],
    ["pure yellow", "#ffff00"],
    ["cyan", "#00ffff"],
    ["magenta (high-chroma)", "#ff00ff"],
    ["pure green", "#00ff00"],
    ["near-white (too-light)", "#fafafa"],
    ["near-black", "#0a0a0a"],
    ["saturated orange", "#ff6a00"],
  ];

  const GAMUTS = ["srgb", "p3"] as const;

  /** Pull the two `oklch(...)` literals out of a baked `light-dark(<light>, <dark>)` value. */
  const LIGHT_DARK = /^light-dark\((oklch\([^)]*\)),\s*(oklch\([^)]*\))\)$/;
  function schemes(value: string): { light: string; dark: string } {
    const m = LIGHT_DARK.exec(value);
    if (!m) throw new Error(`not a light-dark(oklch, oklch) literal: ${value}`);
    return { light: m[1], dark: m[2] };
  }

  /** WCAG ratio between two color strings (each a baked `oklch(...)` literal). */
  function ratio(fg: string, bg: string): number {
    const f = parseColor(fg);
    const b = parseColor(bg);
    if (!f || !b) throw new Error(`unparseable pair: ${fg} / ${bg}`);
    return contrastWCAG(f, b);
  }

  for (const gamut of GAMUTS) {
    for (const [label, seed] of SEEDS) {
      const style = cardSwatches(seed, { gamut });
      const surface = schemes(style["--surface"]);
      const text = schemes(style["--foreground"]);
      const border = schemes(style["--border"]);
      const accent = schemes(style["--accent"]);

      for (const scheme of ["light", "dark"] as const) {
        it(`[${gamut}/${scheme}] ${label}: text on surface ≥ 4.5:1`, () => {
          expect(ratio(text[scheme], surface[scheme])).toBeGreaterThanOrEqual(
            4.5,
          );
        });

        it(`[${gamut}/${scheme}] ${label}: border on surface ≥ 3:1 (non-text UI floor)`, () => {
          expect(ratio(border[scheme], surface[scheme])).toBeGreaterThanOrEqual(
            3,
          );
        });

        it(`[${gamut}/${scheme}] ${label}: accent on surface ≥ 3:1 (non-text UI floor)`, () => {
          expect(ratio(accent[scheme], surface[scheme])).toBeGreaterThanOrEqual(
            3,
          );
        });
      }
    }
  }
});

/**
 * Defensive-totality contract for `cardSwatches`.
 *
 * The featured-home grid brands EVERY featured card from its `themeColor` — including a
 * featured note/essay/now with no `themeColor` (null), or a hostile/garbage value. The engine
 * is the fallback owner, but this consumer promises to NEVER throw and to ALWAYS return four
 * valid `light-dark(oklch(...), oklch(...))` literals. The existing contrast suite only feeds
 * VALID colors; this pins the bad-input edge the author's suite skipped.
 */
describe("cardSwatches — total & defensive on bad themeColor", () => {
  const VARS: readonly CardSwatchVar[] = [
    "--surface",
    "--foreground",
    "--border",
    "--accent",
  ];

  // A baked, scheme-aware literal: light-dark(<oklch light>, <oklch dark>).
  const LIGHT_DARK = /^light-dark\(oklch\([^)]*\),\s*oklch\([^)]*\)\)$/;

  const BAD_INPUTS: readonly [string, unknown][] = [
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["whitespace", "   "],
    ["garbage string", "not-a-color"],
    ["a number", 42],
    ["a plain object", { r: 1 }],
    ["an array", ["oklch(0.7 0.1 200)"]],
    ["boolean true", true],
    ["NaN", Number.NaN],
    ["a broken oklch", "oklch(nonsense)"],
    ["an unclosed function", "oklch(0.7 0.1"],
  ];

  for (const [label, input] of BAD_INPUTS) {
    it(`never throws and returns valid baked literals for ${label}`, () => {
      let swatches!: ReturnType<typeof cardSwatches>;
      expect(() => {
        swatches = cardSwatches(input);
      }).not.toThrow();
      for (const v of VARS) {
        expect(swatches[v]).toMatch(LIGHT_DARK);
      }
    });
  }

  it("returns the SAME fallback palette for every unparseable input (deterministic)", () => {
    const a = cardSwatches(null);
    const b = cardSwatches("not-a-color");
    const c = cardSwatches(undefined);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("a parseable color yields a DIFFERENT (non-fallback) palette", () => {
    const fallback = cardSwatches(null);
    const real = cardSwatches("oklch(0.7 0.2 30)");
    expect(real).not.toEqual(fallback);
    for (const v of VARS) {
      expect(real[v]).toMatch(LIGHT_DARK);
    }
  });
});

/**
 * The PLATE contrast pair — the pair `EntryCard` actually paints.
 *
 * `EntryCard` renders a solid accent PLATE: `background: var(--accent)` with
 * `color: var(--accent-foreground)` (see EntryCard.module.css). Every visible glyph on a card — title,
 * summary, and the mono meta readout — is `--accent-foreground` painted ON the `--accent` fill. The
 * sibling stress-test above (the engine-solves-an-accessible-card-palette suite) proves
 * text/border/accent clear their floors AGAINST THE SURFACE; this suite locks the pair the
 * plate paints instead.
 *
 * Two guards over the same pair:
 *  1. Full-opacity `on-accent` on `accent` clears WCAG 4.5 / APCA Lc 60 — across the solver's
 *     hard theme paths, both schemes, both gamuts, and the fallback palette.
 *  2. The `.meta` row is de-emphasised. Its opacity is read straight from EntryCard.module.css
 *     (defaulting to 1 when the rule carries none), composited over the plate, and asserted to
 *     STILL clear AA — so re-introducing any `opacity < 1` turns this red, because on-accent is
 *     solved with ~zero headroom to spend.
 *
 * Margins are TIGHT by design (worst full ≈ 4.55 WCAG / 60.5 Lc), so a solver regression that
 * eats the `SOLVE_MARGIN` headroom turns this red at the exact place the grid proves it.
 */
describe("cardSwatches — the plate pair (on-accent text on the accent fill) stays legible", () => {
  // [label, themeColor] — the solver's documented hard paths, plus the non-color fallbacks.
  const SEEDS: readonly [string, string | null][] = [
    ["mid blue", "#3b82f6"],
    ["mid red", "#ef4444"],
    ["violet", "#8b5cf6"],
    ["goldenrod (yellow)", "#d4a017"],
    ["pure yellow", "#ffff00"],
    ["cyan", "#00ffff"],
    ["magenta (high-chroma)", "#ff00ff"],
    ["pure green", "#00ff00"],
    ["near-white (too-light)", "#fafafa"],
    ["near-black", "#0a0a0a"],
    ["saturated orange", "#ff6a00"],
    ["null → fallback palette", null],
    ["garbage → fallback palette", "not-a-color"],
  ];

  const GAMUTS = ["srgb", "p3"] as const;

  // The de-emphasis applied to `.meta`, read from the shipped CSS so this guard never drifts.
  const META_CSS = readFileSync(
    resolve(process.cwd(), "src/components/entry/EntryCard.module.css"),
    "utf8",
  );
  const META_RULE = META_CSS.match(/\.meta\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const META_OPACITY = Number(
    META_RULE.match(/opacity:\s*([0-9.]+)/)?.[1] ?? "1",
  );

  /** Pull the two `oklch(...)` literals out of a baked `light-dark(<light>, <dark>)` value. */
  const LIGHT_DARK = /^light-dark\((oklch\([^)]*\)),\s*(oklch\([^)]*\))\)$/;
  function schemes(value: string): { light: string; dark: string } {
    const m = LIGHT_DARK.exec(value);
    if (!m) throw new Error(`not a light-dark(oklch, oklch) literal: ${value}`);
    return { light: m[1], dark: m[2] };
  }

  function toColor(literal: string) {
    const c = parseColor(literal);
    if (!c) throw new Error(`unparseable baked literal: ${literal}`);
    return c;
  }

  /** Composite a foreground over a background at `alpha` — as the browser does, in gamma sRGB. */
  function compositeOver(fgLiteral: string, bgLiteral: string, alpha: number) {
    const f = oklchToSrgb(toColor(fgLiteral));
    const b = oklchToSrgb(toColor(bgLiteral));
    const mix = (k: "r" | "g" | "b") =>
      alpha * clamp01(f[k]) + (1 - alpha) * clamp01(b[k]);
    return srgbToOklch({ r: mix("r"), g: mix("g"), b: mix("b") });
  }

  for (const gamut of GAMUTS) {
    for (const [label, seed] of SEEDS) {
      const style = cardSwatches(seed, { gamut });
      const accent = schemes(style["--accent"]);
      const accentForeground = schemes(style["--accent-foreground"]);

      for (const scheme of ["light", "dark"] as const) {
        const bg = toColor(accent[scheme]);
        const fg = toColor(accentForeground[scheme]);

        it(`[${gamut}/${scheme}] ${label}: on-accent on accent ≥ 4.5:1 (WCAG 2.2 AA body)`, () => {
          expect(contrastWCAG(fg, bg)).toBeGreaterThanOrEqual(4.5);
        });

        it(`[${gamut}/${scheme}] ${label}: on-accent on accent ≥ Lc 60 (APCA label-on-fill quality tier)`, () => {
          expect(apcaLc(fg, bg)).toBeGreaterThanOrEqual(60);
        });

        // The de-emphasised meta row composited at its shipped opacity must STILL clear AA.
        const metaFg = compositeOver(
          accentForeground[scheme],
          accent[scheme],
          META_OPACITY,
        );

        it(`[${gamut}/${scheme}] ${label}: meta@${META_OPACITY} on accent ≥ 4.5:1`, () => {
          expect(contrastWCAG(metaFg, bg)).toBeGreaterThanOrEqual(4.5);
        });

        it(`[${gamut}/${scheme}] ${label}: meta@${META_OPACITY} on accent ≥ Lc 60`, () => {
          expect(apcaLc(metaFg, bg)).toBeGreaterThanOrEqual(60);
        });
      }
    }
  }
});
