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

import { cardSwatches } from "./cardSwatches";

/**
 * The PLATE contrast pair — the pair `EntryCard` actually paints.
 *
 * `EntryCard` renders a solid brand PLATE: `background: var(--accent)` with
 * `color: var(--on-accent)` (see EntryCard.module.css). Every visible glyph on a card — title,
 * blurb, and the mono meta readout — is `--on-accent` painted ON the `--accent` fill. The
 * sibling stress-test (`cardSwatches.contrast.test.ts`) proves text/border/accent clear their
 * floors AGAINST THE SURFACE; this file locks the pair the plate paints instead.
 *
 * Two guards over the same pair:
 *  1. Full-opacity `on-accent` on `accent` clears WCAG 4.5 / APCA Lc 60 — across the solver's
 *     hard brand paths, both schemes, both gamuts, and the fallback palette.
 *  2. The `.meta` row is de-emphasised. Its opacity is read straight from EntryCard.module.css
 *     (defaulting to 1 when the rule carries none), composited over the plate, and asserted to
 *     STILL clear AA — so re-introducing any `opacity < 1` turns this red, because on-accent is
 *     solved with ~zero headroom to spend.
 *
 * Margins are TIGHT by design (worst full ≈ 4.55 WCAG / 60.5 Lc), so a solver regression that
 * eats the `SOLVE_MARGIN` headroom turns this red at the exact place the grid proves it.
 */

// [label, brandColor] — the solver's documented hard paths, plus the non-color fallbacks.
const BRANDS: readonly [string, string | null][] = [
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

describe("cardSwatches — the plate pair (on-accent text on the accent fill) stays legible", () => {
  for (const gamut of GAMUTS) {
    for (const [label, brand] of BRANDS) {
      const style = cardSwatches(brand, { gamut });
      const accent = schemes(style["--accent"]);
      const onAccent = schemes(style["--on-accent"]);

      for (const scheme of ["light", "dark"] as const) {
        const bg = toColor(accent[scheme]);
        const fg = toColor(onAccent[scheme]);

        it(`[${gamut}/${scheme}] ${label}: on-accent on accent ≥ 4.5:1 (WCAG 2.2 AA body)`, () => {
          expect(contrastWCAG(fg, bg)).toBeGreaterThanOrEqual(4.5);
        });

        it(`[${gamut}/${scheme}] ${label}: on-accent on accent ≥ Lc 60 (APCA label-on-fill quality tier)`, () => {
          expect(apcaLc(fg, bg)).toBeGreaterThanOrEqual(60);
        });

        // The de-emphasised meta row composited at its shipped opacity must STILL clear AA.
        const metaFg = compositeOver(
          onAccent[scheme],
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
