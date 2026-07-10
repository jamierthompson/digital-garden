import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildTokenSet,
  THEME_TOKEN_NAMES,
  tokenSetToDeclarations,
} from "@garden/oklch";

/**
 * Executable receipt for the baked fallback theme in `semantic/color.css`: re-derives the engine
 * fallback (`buildTokenSet(undefined)`) and asserts the baked block matches it EXACTLY — every
 * engine token present with the engine's value, and no extra hand-authored color token. An engine
 * change or a hand-edit goes red instead of silently shipping a stale value. Contrast is owned by
 * the engine's own suite; matching its output transitively guarantees it.
 */
const SHEET = readFileSync(
  resolve(process.cwd(), "src/styles/semantic/color.css"),
  "utf8",
);

const normalize = (v: string): string =>
  v.trim().replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");

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
const ENGINE_TOKENS = Object.keys(ENGINE_DECLS);

describe("semantic/color.css IS the engine's complete fallback token set", () => {
  it("parsed a non-trivial sheet AND a full engine set (false-green guard)", () => {
    expect(Object.keys(SHEET_DECLS).length).toBeGreaterThan(10);
    expect(ENGINE_TOKENS.length).toBeGreaterThanOrEqual(30);
    expect(SHEET_DECLS["--background"]).toBeDefined();
  });

  // QA #229: the bijection above compares sheet ⇄ engine-output-of-the-moment — if the
  // engine ever silently dropped a token, BOTH sides would shrink and the suite would stay
  // green. Pin the engine set to the canonical 37-name contract so the sheet is transitively
  // pinned to THEME_TOKEN_NAMES itself (`--muted` + the `--accent-subtle` pair included).
  it("the engine set IS the canonical 37-token contract (sheet transitively pinned to it)", () => {
    expect([...ENGINE_TOKENS].sort()).toEqual(
      THEME_TOKEN_NAMES.map((name) => `--${name}`).sort(),
    );
    expect(THEME_TOKEN_NAMES).toHaveLength(37);
  });

  for (const token of ENGINE_TOKENS) {
    it(`${token} equals the live engine fallback (buildTokenSet(undefined))`, () => {
      expect(SHEET_DECLS[token]).toBe(ENGINE_DECLS[token]);
    });
  }

  // `--ring` is the engine-emitted focus color read directly by `:focus-visible` — no alias
  // step. The forward loop above already pins it to the engine value like any other token.
  it("emits --ring as an engine token (no --focus-ring-color alias)", () => {
    expect(SHEET_DECLS["--ring"]).toBe(ENGINE_DECLS["--ring"]);
    expect(SHEET_DECLS["--focus-ring-color"]).toBeUndefined();
  });
});

describe("semantic/color.css color is engine-derived, not hand-authored", () => {
  it("solves the status tokens through the engine — no hand-authored hex", () => {
    for (const t of ["--success", "--error", "--warning", "--info"]) {
      expect(SHEET_DECLS[t]).toBe(ENGINE_DECLS[t]);
      expect(SHEET_DECLS[t]).toContain("oklch(");
      expect(SHEET_DECLS[t]).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });

  it("declares no --neutral-* ramp", () => {
    expect(
      Object.keys(SHEET_DECLS).some((k) => k.startsWith("--neutral-")),
    ).toBe(false);
  });

  // The forward loop pins engine ⊆ sheet. This pins the REVERSE: a hand-authored color token
  // isn't in ENGINE_TOKENS, so no forward `it` looks at it. Requiring every color-valued
  // declaration to be an engine token makes the color surface a strict bijection.
  it("carries NO color-valued token beyond the engine set (reverse guard)", () => {
    const engineTokens = new Set(ENGINE_TOKENS);
    const sheetColorTokens = Object.entries(SHEET_DECLS)
      .filter(([, v]) => /oklch\(|#[0-9a-f]{3,8}/i.test(v))
      .map(([k]) => k);
    const extras = sheetColorTokens.filter((t) => !engineTokens.has(t));
    expect(extras).toEqual([]);
    expect(new Set(sheetColorTokens)).toEqual(engineTokens);
  });

  // Pre-split, the bijection above scanned the whole monolith, so a hand-authored color
  // anywhere in the token sheets tripped it. Post-split it only reads color.css — so extend
  // the reverse guard to the TREE: no other src/styles sheet may declare a color value at all,
  // keeping color.css the single (engine-derived) color surface.
  it("no other src/styles sheet declares a color value (tree-wide reverse guard)", () => {
    const stylesDir = resolve(process.cwd(), "src/styles");
    const otherSheets = readdirSync(stylesDir, { recursive: true })
      .map((entry) => String(entry).split("\\").join("/"))
      .filter((entry) => entry.endsWith(".css"))
      .filter((entry) => entry !== "semantic/color.css");
    expect(otherSheets.length).toBeGreaterThan(0);
    for (const sheet of otherSheets) {
      const css = readFileSync(resolve(stylesDir, sheet), "utf8").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      );
      expect(
        /oklch\(|oklab\(|light-dark\(|#[0-9a-f]{3,8}\b|\brgb\(|\bhsl\(/i.test(
          css,
        ),
        `src/styles/${sheet} declares a color value — colors live only in semantic/color.css (engine-derived)`,
      ).toBe(false);
    }
  });
});
