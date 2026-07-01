import { describe, expect, it } from "vitest";

import { apcaLc, contrastWCAG, parseColor } from "@garden/oklch";

/**
 * Accessibility guard for the GLOBAL EDITORIAL default tokens in `foundation.css`.
 *
 * The engine solves each project slot's tokens above the contrast floor (with a baked-in
 * `SOLVE_MARGIN`), and has its own contrast suite. But the editorial defaults the chrome
 * reads are **hand-authored hex** — nothing else measures them, so a future edit to a
 * neutral step or a status hue could silently drop an editorial text pair under WCAG 2.2
 * AA. This is the guard.
 *
 * Mirror of `src/app/foundation.css` (`@layer foundation` neutral ramp + `@layer semantic`
 * defaults). Keep in sync when either changes — the whole point is that this test goes red
 * if the sheet drifts under the floor.
 */
const NEUTRAL: Record<string, string> = {
  "0": "#ffffff",
  "100": "#f5f5f5",
  "200": "#e5e5e5",
  "400": "#a3a3a3",
  "600": "#525252",
  "700": "#404040",
  "800": "#262626",
  "900": "#171717",
  "950": "#0a0a0a",
};

// Each semantic token → its resolved [light, dark] hex (from the `light-dark()` defaults).
const SEMANTIC: Record<string, [string, string]> = {
  bg: [NEUTRAL["0"], NEUTRAL["950"]],
  surface: [NEUTRAL["0"], NEUTRAL["900"]],
  "surface-2": [NEUTRAL["100"], NEUTRAL["800"]],
  text: [NEUTRAL["900"], NEUTRAL["100"]],
  "text-muted": [NEUTRAL["600"], NEUTRAL["400"]],
  border: [NEUTRAL["200"], NEUTRAL["700"]],
  accent: [NEUTRAL["900"], NEUTRAL["100"]],
  "accent-text": [NEUTRAL["900"], NEUTRAL["100"]],
  "on-accent": [NEUTRAL["0"], NEUTRAL["950"]],
  "focus-ring": [NEUTRAL["900"], NEUTRAL["100"]],
  success: ["#15803d", "#4ade80"],
  error: ["#b91c1c", "#f87171"],
  warning: ["#b45309", "#fbbf24"],
  info: ["#1d4ed8", "#60a5fa"],
};

const SCHEMES = [
  { name: "light", i: 0 },
  { name: "dark", i: 1 },
] as const;
const tok = (name: string, i: 0 | 1) => parseColor(SEMANTIC[name][i])!;

// Roles used as text/icons must clear the WCAG 2.2 AA small-text floor (4.5:1) on every
// surface they can sit on. (`--border` is decorative — hairline outlines/dividers, exempt
// under 1.4.11 — so it is intentionally not in this list.)
const TEXT_ROLES = [
  "text",
  "text-muted",
  "accent-text",
  "success",
  "error",
  "warning",
  "info",
] as const;
const SURFACES = ["bg", "surface", "surface-2"] as const;

describe("editorial semantic tokens clear WCAG 2.2 AA", () => {
  for (const { name: scheme, i } of SCHEMES) {
    for (const role of TEXT_ROLES) {
      for (const bg of SURFACES) {
        it(`[${scheme}] ${role} on ${bg} ≥ 4.5:1`, () => {
          expect(contrastWCAG(tok(role, i), tok(bg, i))).toBeGreaterThanOrEqual(
            4.5,
          );
        });
      }
    }

    it(`[${scheme}] on-accent reads on the accent fill ≥ 4.5:1`, () => {
      // Editorial accent == ink; on-accent == paper. A high-contrast inversion.
      expect(
        contrastWCAG(tok("on-accent", i), tok("accent", i)),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`[${scheme}] body text (--text on --bg) meets the APCA Lc-75 body quality goal`, () => {
      // --text is the one true body-text role; it must clear the higher perceptual bar,
      // not just the legal floor. (Muted/status/UI ride lower tiers and are only held to
      // the WCAG floor above — the editorial status hues don't reach Lc-75 in dark, a
      // known quality gap to revisit when editorial status UI ships / with the Palette
      // Studio, #78.)
      expect(apcaLc(tok("text", i), tok("bg", i))).toBeGreaterThanOrEqual(75);
    });
  }
});
