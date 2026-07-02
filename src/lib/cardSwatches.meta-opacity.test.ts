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
 * QA-added (independent adversarial pass) — the de-emphasised meta readout MUST still clear
 * WCAG AA on the plate.
 *
 * `EntryCard.module.css` `.meta` (the mono "stage · seed" readout, `--text-sm` ≈ 12.8px →
 * NORMAL text, WCAG floor 4.5:1) applies `opacity: 0.8`. The browser composites that text
 * toward the plate it sits on, so its EFFECTIVE contrast is lower than the solved `--on-accent`
 * pair. The engine solves `--on-accent` to only just clear 4.5:1 (worst ≈ 4.55, ~zero
 * headroom), so the 0.8 opacity pushes the meta row UNDER the AA floor for most brand hues in
 * the light scheme.
 *
 * This test composites `--on-accent` over `--accent` at the SHIPPED `.meta` opacity and
 * asserts the result still clears WCAG AA (and the APCA Lc 60 label tier the engine targeted).
 * The opacity is read straight from `EntryCard.module.css` (defaulting to 1 when the rule
 * carries none), so the guard always reflects the real shipped value — re-introducing any
 * `opacity < 1` on `.meta` turns this red, because on-accent has ~zero headroom to spend.
 */
const META_CSS = readFileSync(
  resolve(process.cwd(), "src/components/entry/EntryCard.module.css"),
  "utf8",
);
const META_RULE = META_CSS.match(/\.meta\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const META_OPACITY = Number(
  META_RULE.match(/opacity:\s*([0-9.]+)/)?.[1] ?? "1",
);

const BRANDS: readonly [string, string | null][] = [
  ["mid blue", "#3b82f6"],
  ["mid red", "#ef4444"],
  ["violet", "#8b5cf6"],
  ["goldenrod (yellow)", "#d4a017"],
  ["pure yellow", "#ffff00"],
  ["cyan", "#00ffff"],
  ["magenta (high-chroma)", "#ff00ff"],
  ["pure green", "#00ff00"],
  ["saturated orange", "#ff6a00"],
  ["null → fallback palette", null],
];

const GAMUTS = ["srgb", "p3"] as const;

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

describe("EntryCard .meta — the de-emphasised readout still clears WCAG AA on the plate", () => {
  for (const gamut of GAMUTS) {
    for (const [label, brand] of BRANDS) {
      const style = cardSwatches(brand, { gamut });
      const accent = schemes(style["--accent"]);
      const onAccent = schemes(style["--on-accent"]);

      for (const scheme of ["light", "dark"] as const) {
        const bg = toColor(accent[scheme]);
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
