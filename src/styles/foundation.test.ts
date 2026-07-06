import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { apcaLc, contrastWCAG, parseColor } from "@garden/oklch";

/**
 * Accessibility + cascade guards for the GLOBAL EDITORIAL defaults in `src/styles/foundation.css`.
 *
 * Three concerns, one subject (`foundation.css`), so one co-located suite:
 *  1. The editorial semantic tokens clear WCAG 2.2 AA — asserted against a hand-authored MIRROR
 *     of the sheet (fast, explicit) …
 *  2. … AND against the sheet PARSED FROM SOURCE, so the mirror can't silently drift out of sync
 *     (the false-green guard the adversarial review added).
 *  3. The `@layer` order statement is pinned (the #132 `project` → `components` rename guard).
 *
 * Resolve the sheet from the repo root (vitest's cwd); jsdom gives `import.meta.url` a
 * non-file scheme, so a file-URL resolution can't be used here.
 */
const SHEET = readFileSync(
  resolve(process.cwd(), "src/styles/foundation.css"),
  "utf8",
);

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
const SCHEMES = [
  { name: "light", i: 0 },
  { name: "dark", i: 1 },
] as const;

// --- Mirror of foundation.css (`@layer foundation` neutral ramp + `@layer semantic`
// defaults). Keep in sync when either changes — the parsed-from-source suite below is the
// backstop that goes red if this mirror drifts. ---
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

const tok = (name: string, i: 0 | 1) => parseColor(SEMANTIC[name][i])!;

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

// --- Parsed-from-source: the drift backstop for the mirror above. Reads the ACTUAL sheet,
// resolves every semantic role through the declared `--neutral-*` primitives, and runs the
// same floor checks on the PARSED values — so it cannot fall out of sync. If someone
// regresses the sheet, THIS goes red even if the mirror is stale. ---

/** `--neutral-500: #737373;` → { "neutral-500": "#737373" }. */
function parseNeutralRamp(css: string): Record<string, string> {
  const ramp: Record<string, string> = {};
  for (const m of css.matchAll(/--(neutral-\d+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    ramp[m[1]] = m[2];
  }
  return ramp;
}

/**
 * Resolve a semantic token's `light-dark(<light>, <dark>)` value into `[lightHex, darkHex]`,
 * following `var(--neutral-*)` references through the ramp. Returns null for tokens that are
 * not a two-arg `light-dark()` of resolvable colors (e.g. `--font-face`).
 */
function resolveSemantic(
  name: string,
  css: string,
  ramp: Record<string, string>,
): [string, string] | null {
  const decl = new RegExp(`--${name}:\\s*light-dark\\(([^;]+)\\)\\s*;`).exec(
    css,
  );
  if (!decl) return null;
  const args = splitTopLevel(decl[1]);
  if (args.length !== 2) return null;
  const resolve1 = (raw: string): string | null => {
    const t = raw.trim();
    const v = /^var\(\s*--([a-z0-9-]+)\s*\)$/.exec(t);
    if (v) return ramp[v[1]] ?? null;
    if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t;
    return null;
  };
  const light = resolve1(args[0]);
  const dark = resolve1(args[1]);
  return light && dark ? [light, dark] : null;
}

/** Split "a, b" on the TOP-LEVEL comma only (so `var(--x)` internals are safe). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const RAMP = parseNeutralRamp(SHEET);

// Sanity-check the parser found a real ramp — a silently empty parse would make every
// assertion below vacuously pass, which is the exact false-green we are here to prevent.
describe("foundation.css parser sanity", () => {
  it("extracted a non-trivial neutral ramp", () => {
    expect(Object.keys(RAMP).length).toBeGreaterThanOrEqual(9);
    expect(RAMP["neutral-0"]).toBe("#ffffff");
  });
});

function pair(name: string): [string, string] {
  const p = resolveSemantic(name, SHEET, RAMP);
  if (!p)
    throw new Error(`could not resolve semantic --${name} from foundation.css`);
  return p;
}
const hex = (name: string, i: 0 | 1): string => pair(name)[i];

describe("foundation.css (parsed from source) clears WCAG 2.2 AA", () => {
  for (const { name: scheme, i } of SCHEMES) {
    for (const role of TEXT_ROLES) {
      for (const bg of SURFACES) {
        it(`[${scheme}] ${role} on ${bg} ≥ 4.5:1`, () => {
          const fg = parseColor(hex(role, i))!;
          const back = parseColor(hex(bg, i))!;
          expect(fg).not.toBeNull();
          expect(back).not.toBeNull();
          expect(contrastWCAG(fg, back)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    it(`[${scheme}] on-accent on accent ≥ 4.5:1`, () => {
      expect(
        contrastWCAG(
          parseColor(hex("on-accent", i))!,
          parseColor(hex("accent", i))!,
        ),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`[${scheme}] body --text on --bg meets the APCA Lc-75 quality goal`, () => {
      expect(
        apcaLc(parseColor(hex("text", i))!, parseColor(hex("bg", i))!),
      ).toBeGreaterThanOrEqual(75);
    });
  }
});

// --- Cascade guard: the `@layer` statement in foundation.css is load-bearing. It fixes the
// cascade priority of the four layers, lowest-priority FIRST (`components`, declared last, is
// the strongest — component rules must out-rank the foundation reset). `check-css-layers.mjs`
// only proves every rule is INSIDE some `@layer` — it is name-agnostic, so it would NOT catch
// the 4th layer regressing from the #132 rename (`project` → `components`) nor a reordering.
// This is that guard: fail-first if the order string drifts or reverts to `@layer … project`. ---
describe("foundation.css @layer order statement (#132 rename guard)", () => {
  it("declares the four layers lowest-first: foundation, semantic, brand, components", () => {
    expect(SHEET).toContain("@layer foundation, semantic, brand, components;");
  });

  it("no longer names the retired 4th layer `project`", () => {
    // The old fourth layer was `@layer … project;`. The rename must have removed it entirely —
    // not just added `components` alongside a surviving `project`.
    expect(/@layer[^;]*\bproject\b[^;]*;/.test(SHEET)).toBe(false);
  });
});
