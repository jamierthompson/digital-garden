import { describe, expect, it } from "vitest";

import { apcaLc, contrastWCAG, parseColor } from "@garden/oklch";

import { cardSwatches } from "./cardSwatches";

/**
 * The PLATE contrast pair — QA-added (independent adversarial pass).
 *
 * `EntryCard` renders a solid brand PLATE: `background: var(--accent)` with
 * `color: var(--on-accent)` (see EntryCard.module.css). Every visible glyph on a card —
 * title, blurb, and the mono meta readout — is `--on-accent` painted ON the `--accent`
 * fill. The sibling stress-test (`cardSwatches.contrast.test.ts`) proves text/border/accent
 * clear their floors AGAINST THE SURFACE, but nothing asserted the pair the plate actually
 * paints: on-accent text ON the accent fill. This locks that pair.
 *
 * The engine co-solves `on-accent` against `accent` to WCAG 4.5 / APCA Lc 60 (palette.ts
 * `TARGET.onAccent`). We parse the BAKED `light-dark()` literals a card ships back out and
 * assert the shipped pair still clears both floors — across the solver's hard brand paths,
 * both schemes, both gamuts, AND the fallback palette (a null / garbage seed still paints a
 * legible plate). Margins are TIGHT by design (worst observed ≈ 4.55 WCAG / 60.5 Lc), so a
 * solver regression that eats the `SOLVE_MARGIN` headroom turns this red at the exact place
 * the grid is meant to prove it.
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

describe("cardSwatches — the plate pair (on-accent text on the accent fill) stays legible", () => {
  for (const gamut of GAMUTS) {
    for (const [label, brand] of BRANDS) {
      const style = cardSwatches(brand, { gamut });
      const accent = schemes(style["--accent"]);
      const onAccent = schemes(style["--on-accent"]);

      for (const scheme of ["light", "dark"] as const) {
        const fg = toColor(onAccent[scheme]);
        const bg = toColor(accent[scheme]);

        it(`[${gamut}/${scheme}] ${label}: on-accent on accent ≥ 4.5:1 (WCAG 2.2 AA body)`, () => {
          expect(contrastWCAG(fg, bg)).toBeGreaterThanOrEqual(4.5);
        });

        it(`[${gamut}/${scheme}] ${label}: on-accent on accent ≥ Lc 60 (APCA label-on-fill quality tier)`, () => {
          expect(apcaLc(fg, bg)).toBeGreaterThanOrEqual(60);
        });
      }
    }
  }
});
