import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildTokenSet, tokenSetToDeclarations } from "@garden/oklch";

/**
 * Guards for the fallback theme + cascade statement in `src/styles/foundation.css`.
 *
 * The `:root` semantic color tokens are the COMPLETE engine token set from the engine's own
 * fallback seed (`buildTokenSet(undefined)`) baked as static `light-dark()` literals — the same
 * derivation every seeded page uses, so a surface with no `<html>` theme (404 / error / loading +
 * chrome) renders a full, coherent engine theme. This suite is the executable RECEIPT: it
 * re-derives the engine fallback and asserts the baked block matches it EXACTLY — every engine
 * token present with the engine's value, and no extra hand-authored semantic color token. So a
 * drift (an engine change) or a hand-edit goes red instead of silently shipping a stale or
 * hand-picked value; #161's hand-authored status literals are gone (status is now engine-solved).
 * Contrast is owned by the engine's own suite — matching its output transitively guarantees it.
 * Also pins that the neutral ramp is gone and the `@layer` order is right (now `brand`-free).
 *
 * Resolve the sheet from the repo root (vitest's cwd); jsdom gives `import.meta.url` a
 * non-file scheme, so a file-URL resolution can't be used here.
 */
const SHEET = readFileSync(
  resolve(process.cwd(), "src/styles/foundation.css"),
  "utf8",
);

/** Collapse whitespace (incl. prettier's inner-paren line breaks) so the comparison survives
 * reflow but still pins the values. */
const normalize = (v: string): string =>
  v.trim().replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");

// Strip CSS block comments, then collect every `--name: value;` custom-property declaration.
function parseDeclarations(css: string): Record<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const decls: Record<string, string> = {};
  for (const m of withoutComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    decls[m[1]] = normalize(m[2]);
  }
  return decls;
}

const SHEET_DECLS = parseDeclarations(SHEET);
const ENGINE_DECLS = parseDeclarations(
  tokenSetToDeclarations(buildTokenSet(undefined)),
);

// Every token the engine's fallback set emits — the complete list the `:root` block must carry,
// verbatim from the engine output (bg/surface/text/…, the full status tiers, hover/selected/scrim).
const ENGINE_TOKENS = Object.keys(ENGINE_DECLS);

describe("foundation.css :root fallback IS the engine's complete fallback token set", () => {
  it("parsed a non-trivial sheet AND a full engine set (false-green guard)", () => {
    expect(Object.keys(SHEET_DECLS).length).toBeGreaterThan(10);
    // The engine emits the whole semantic tier — surfaces, ink, accent, all four status tiers,
    // hover/selected/scrim. A truncated engine set would make the loop below vacuously weak.
    expect(ENGINE_TOKENS.length).toBeGreaterThanOrEqual(30);
    expect(SHEET_DECLS["--bg"]).toBeDefined();
  });

  for (const token of ENGINE_TOKENS) {
    it(`${token} equals the live engine fallback (buildTokenSet(undefined))`, () => {
      expect(SHEET_DECLS[token]).toBe(ENGINE_DECLS[token]);
    });
  }

  it("aliases --focus-ring-color to the semantic focus-ring token", () => {
    expect(SHEET_DECLS["--focus-ring-color"]).toBe("var(--focus-ring)");
  });
});

describe("foundation.css color is engine-derived, not hand-authored", () => {
  it("solves the status tokens through the engine — no hand-authored hex (closes #161)", () => {
    for (const t of ["--success", "--error", "--warning", "--info"]) {
      expect(SHEET_DECLS[t]).toBe(ENGINE_DECLS[t]);
      // Engine output is `oklch()`, never the old hand-picked hex literals.
      expect(SHEET_DECLS[t]).toContain("oklch(");
      expect(SHEET_DECLS[t]).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });

  it("declares no --neutral-* ramp", () => {
    expect(
      Object.keys(SHEET_DECLS).some((k) => k.startsWith("--neutral-")),
    ).toBe(false);
  });

  // The forward guards above pin engine ⊆ sheet (every engine token present + valued correctly).
  // They do NOT pin the REVERSE (sheet-color ⊆ engine) — yet this suite's own header claims "no
  // extra hand-authored semantic color token" gets caught. Without this, a hand-authored color
  // token smuggled into `:root` (a re-introduced #161-style status hex, a bespoke `--brand-x`)
  // would ship un-caught: it isn't in `ENGINE_TOKENS`, so no forward `it` ever looks at it. This
  // closes that gap — every color-valued declaration in the sheet MUST be an engine token, so the
  // color surface is a strict bijection with `buildTokenSet(undefined)`, never a superset.
  it("carries NO color-valued token beyond the engine set (reverse guard: no hand-authored color can hide)", () => {
    const engineTokens = new Set(ENGINE_TOKENS);
    const sheetColorTokens = Object.entries(SHEET_DECLS)
      .filter(([, v]) => /oklch\(|#[0-9a-f]{3,8}/i.test(v))
      .map(([k]) => k);
    const extras = sheetColorTokens.filter((t) => !engineTokens.has(t));
    expect(extras).toEqual([]);
    // Bijection, not just subset: the color tokens in the sheet are EXACTLY the engine set.
    expect(new Set(sheetColorTokens)).toEqual(engineTokens);
  });

  it("keeps the global editorial font tokens", () => {
    expect(SHEET_DECLS["--font-face"]).toContain("--font-source-serif-4");
    expect(SHEET_DECLS["--font-display"]).toContain("--font-space-grotesk");
    expect(SHEET_DECLS["--font-mono"]).toContain("--font-jetbrains-mono");
  });
});

// The `@layer` statement is load-bearing: it fixes cascade priority lowest-first (`components`
// last = strongest). `check-css-layers.mjs` only proves every rule is INSIDE some layer, so it
// would not catch a reordering or a stale `brand` (the deleted slot machinery's layer).
describe("foundation.css @layer order statement", () => {
  it("declares the three layers lowest-first: foundation, semantic, components", () => {
    expect(SHEET).toContain("@layer foundation, semantic, components;");
  });

  it("no longer names the retired `brand` or `project` layer in the statement", () => {
    expect(SHEET).not.toContain(
      "@layer foundation, semantic, brand, components;",
    );
    expect(/@layer[^{;]*\bbrand\b/.test(SHEET)).toBe(false);
    expect(/@layer[^{;]*\bproject\b/.test(SHEET)).toBe(false);
  });
});
