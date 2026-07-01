import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { apcaLc, contrastWCAG, parseColor } from "@garden/oklch";

/**
 * QA guard (added by adversarial review) that closes the drift trap in
 * `foundation.contrast.test.ts`.
 *
 * That sibling suite hand-copies the neutral ramp + the semantic `light-dark()` mapping into
 * TS constants and its own docstring warns "Keep in sync when either changes." That is a
 * FALSE-GREEN hazard: edit `foundation.css` so an editorial text pair drops under WCAG 2.2 AA
 * but forget to update the mirror, and the sibling test keeps asserting the STALE (passing)
 * values while the real sheet ships inaccessible. Vigilance is not a guard.
 *
 * This suite reads the ACTUAL `foundation.css`, resolves every semantic role token through the
 * declared `--neutral-*` primitives, and runs the same floor checks on the PARSED values — so
 * it cannot drift out of sync with the sheet. If someone regresses the sheet, THIS goes red.
 */
const SHEET = readFileSync(
  resolve(process.cwd(), "src/app/foundation.css"),
  "utf8",
);

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
