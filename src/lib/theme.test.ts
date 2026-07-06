import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyThemeDeclarations,
  resolveThemeDeclarations,
  themeInitScript,
  type ThemeDeclaration,
} from "./theme";

const ORANGE = "#c2410c";
const BLUE = "#1d4ed8";

// The semantic role names components actually read — the generic contract the engine themes
// and `foundation.css` binds as the editorial default.
const CORE_ROLES = [
  "--surface",
  "--accent",
  "--text",
  "--on-accent",
  "--success",
] as const;

const accentOf = (seed: unknown): string | undefined =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

describe("resolveThemeDeclarations", () => {
  it("returns the semantic tokens as [--name, light-dark(...)] pairs", () => {
    const declarations = resolveThemeDeclarations(ORANGE);
    expect(declarations.length).toBeGreaterThan(0);
    for (const [name, value] of declarations) {
      expect(name.startsWith("--")).toBe(true);
      // Both schemes zipped into a native light-dark() literal (the token model's premise).
      expect(value).toMatch(/^light-dark\(.+,.+\)$/);
    }
    const map = Object.fromEntries(declarations);
    for (const role of CORE_ROLES) expect(map[role]).toBeDefined();
  });

  it("is deterministic — the same seed yields identical declarations", () => {
    expect(resolveThemeDeclarations(ORANGE)).toEqual(
      resolveThemeDeclarations(ORANGE),
    );
  });

  it("themes differently for different seeds", () => {
    expect(accentOf(ORANGE)).not.toBe(accentOf(BLUE));
  });

  it("never throws on an unparseable seed — returns a safe fallback set", () => {
    let declarations: ThemeDeclaration[] = [];
    expect(() => {
      declarations = resolveThemeDeclarations("not-a-color");
    }).not.toThrow();
    expect(declarations.length).toBeGreaterThan(0);
    expect(Object.fromEntries(declarations)["--accent"]).toBeDefined();
  });
});

describe("applyThemeDeclarations", () => {
  afterEach(() => document.documentElement.removeAttribute("style"));

  it("stamps every declaration onto <html>", () => {
    applyThemeDeclarations([
      ["--accent", "red"],
      ["--surface", "blue"],
    ]);
    const { style } = document.documentElement;
    expect(style.getPropertyValue("--accent")).toBe("red");
    expect(style.getPropertyValue("--surface")).toBe("blue");
  });

  it("layers alongside an inline color-scheme — never clobbers it (scheme-toggle coexistence)", () => {
    // The scheme toggle writes `color-scheme` inline on <html>; theming must not wipe it.
    document.documentElement.style.colorScheme = "dark";
    applyThemeDeclarations([["--accent", "red"]]);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      "red",
    );
  });
});

describe("themeInitScript", () => {
  afterEach(() => document.documentElement.removeAttribute("style"));

  it("produces a self-contained script that stamps <html> when executed (flash-free hard load)", () => {
    const declarations = resolveThemeDeclarations(ORANGE);
    // Run it exactly as the browser would during HTML parse.
    new Function(themeInitScript(declarations))();
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      Object.fromEntries(declarations)["--accent"],
    );
  });

  it("bakes the seed's values in — no localStorage read (the seed is server-known)", () => {
    const script = themeInitScript(resolveThemeDeclarations(ORANGE));
    expect(script).not.toMatch(/localStorage/);
    expect(script).toContain("setProperty");
    // Distinct seeds bake distinct scripts.
    expect(script).not.toBe(themeInitScript(resolveThemeDeclarations(BLUE)));
  });
});

describe("isomorphism", () => {
  it("resolveThemeDeclarations + themeInitScript run with no DOM globals (server-safe)", () => {
    // The pure half of the module must not touch the DOM — only applyThemeDeclarations does.
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    try {
      const script = themeInitScript(resolveThemeDeclarations(ORANGE));
      expect(script).toContain("setProperty");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
