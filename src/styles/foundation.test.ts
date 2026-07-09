import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildTokenSet, tokenSetToDeclarations } from "@garden/oklch";

/**
 * Guards for the fallback theme + cascade statement in `src/styles/foundation.css`.
 *
 * The `:root` semantic color tokens are the COMPLETE engine token set from the engine's fallback
 * seed (`buildTokenSet(undefined)`) baked as static `light-dark()` literals. This suite is the
 * executable RECEIPT: it re-derives the engine fallback and asserts the baked block matches it
 * EXACTLY — every engine token present with the engine's value, and no extra hand-authored color
 * token — so an engine change or a hand-edit goes red instead of silently shipping a stale value.
 * Contrast is owned by the engine's own suite; matching its output transitively guarantees it.
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

// Every token the engine's fallback set emits — the complete set of COLOR tokens the `:root` block
// must carry, verbatim from the engine output (bg/surface/text/…, the full status tiers,
// hover/selected/scrim). Non-color semantic roles (type, space) live in @layer semantic too but
// aren't engine-emitted, so they're out of scope here.
const ENGINE_TOKENS = Object.keys(ENGINE_DECLS);

describe("foundation.css :root fallback IS the engine's complete fallback token set", () => {
  it("parsed a non-trivial sheet AND a full engine set (false-green guard)", () => {
    expect(Object.keys(SHEET_DECLS).length).toBeGreaterThan(10);
    // The engine emits the whole semantic COLOR tier — surfaces, ink, accent, all four status
    // tiers, hover/selected/scrim. A truncated engine set would make the loop below vacuously weak.
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
  it("solves the status tokens through the engine — no hand-authored hex", () => {
    for (const t of ["--success", "--error", "--warning", "--info"]) {
      expect(SHEET_DECLS[t]).toBe(ENGINE_DECLS[t]);
      // Engine output is `oklch()`, not hex.
      expect(SHEET_DECLS[t]).toContain("oklch(");
      expect(SHEET_DECLS[t]).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });

  it("declares no --neutral-* ramp", () => {
    expect(
      Object.keys(SHEET_DECLS).some((k) => k.startsWith("--neutral-")),
    ).toBe(false);
  });

  // Forward guards pin engine ⊆ sheet. This pins the REVERSE: a hand-authored color token
  // smuggled into `:root` isn't in `ENGINE_TOKENS`, so no forward `it` looks at it. Requiring
  // every color-valued declaration to be an engine token makes the color surface a strict
  // bijection with `buildTokenSet(undefined)`, never a superset.
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

// The base `h1`–`h6` element rule is the ONE place headings bind the display face. Declared once
// here, the drift it guards against — a heading forgetting `--font-display` and inheriting the
// body serif — is impossible by construction.
describe("foundation.css base heading element rule", () => {
  // Strip comments so a `--font-display` mention in prose can't satisfy the assertion.
  const CODE = SHEET.replace(/\/\*[\s\S]*?\*\//g, "");
  const headingRule = CODE.match(
    /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{([^}]*)\}/,
  );

  it("binds --font-display on h1–h6 (the display/body-face split, applied once)", () => {
    expect(headingRule).not.toBeNull();
    expect(/font-family:\s*var\(--font-display\)/.test(headingRule![1])).toBe(
      true,
    );
  });
});

// The `@layer` statement is load-bearing: it fixes cascade priority lowest-first (`components`
// last = strongest). `check-css-layers.mjs` only proves every rule is INSIDE some layer, so it
// would not catch a reordering or a stray `brand`/`project` layer.
describe("foundation.css @layer order statement", () => {
  it("declares the three layers lowest-first: foundation, semantic, components", () => {
    expect(SHEET).toContain("@layer foundation, semantic, components;");
  });

  it("excludes the `brand` and `project` layers from the statement", () => {
    expect(SHEET).not.toContain(
      "@layer foundation, semantic, brand, components;",
    );
    expect(/@layer[^{;]*\bbrand\b/.test(SHEET)).toBe(false);
    expect(/@layer[^{;]*\bproject\b/.test(SHEET)).toBe(false);
  });
});
