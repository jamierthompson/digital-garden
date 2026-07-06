import { buildTokenSet, tokenSetToDeclarations } from "@garden/oklch";
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

// --- Adversarial QA (#172): the engine↔parser coupling, hostile seeds, and the injection
// path. `parseDeclarations` is private by design, so every pin runs through the public
// wrapper against the engine's REAL output — if the engine's serialization format drifts
// (multi-decl lines, a changed joiner, a new non-custom-property line), these fail HERE
// instead of shipping a silently-collapsed theme. ---

describe("engine↔parser serialization contract (QA #172)", () => {
  const raw = tokenSetToDeclarations(buildTokenSet("#c2410c"));

  it("the engine emits exactly one `--name: value;` per \\n-joined line (the parser's premise)", () => {
    const lines = raw.split("\n");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      // One declaration per line: a custom property, a single `: ` separator reachable by
      // `indexOf(":")`, a trailing `;` — and no second declaration smuggled onto the line.
      expect(line).toMatch(/^--[a-z0-9-]+: [^;\n]+;$/);
    }
  });

  it("parsing is lossless — the pairs reassemble byte-for-byte to the engine's output", () => {
    const reassembled = resolveThemeDeclarations(ORANGE)
      .map(([property, value]) => `${property}: ${value};`)
      .join("\n");
    expect(reassembled).toBe(raw);
  });

  it("nested-paren values (light-dark(oklch(…), oklch(…))) survive unclipped and balanced", () => {
    for (const [, value] of resolveThemeDeclarations(ORANGE)) {
      expect(value).not.toContain(";");
      expect(value).not.toContain("\n");
      let depth = 0;
      for (const ch of value) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
      expect(depth).toBe(0);
    }
  });

  it("the engine's colorScheme opt-line is a non-custom-property line the parser must skip", () => {
    // `resolveThemeDeclarations` never opts in, but pin the opt-line's real shape so the
    // parser's skip rule (`--` prefix required) provably covers it if that ever changes.
    const withScheme = tokenSetToDeclarations(buildTokenSet("#c2410c"), {
      colorScheme: true,
    });
    expect(withScheme.split("\n")[0]).toBe("color-scheme: light dark;");
    for (const [property] of resolveThemeDeclarations(ORANGE)) {
      expect(property.startsWith("--")).toBe(true);
    }
  });

  it("every seed — valid or garbage — yields the SAME complete property list (full-overwrite invariant)", () => {
    // Load-bearing for <Activity> reveal: the re-stamp must fully overwrite the previous
    // route's theme. A seed-dependent property list would leak stale tokens through.
    const names = (seed: unknown): string[] =>
      resolveThemeDeclarations(seed).map(([property]) => property);
    const expected = names(ORANGE);
    expect(expected.length).toBeGreaterThan(0);
    expect(new Set(expected).size).toBe(expected.length);
    expect(names(BLUE)).toEqual(expected);
    expect(names("not-a-color")).toEqual(expected);
    expect(names(undefined)).toEqual(expected);
  });
});

describe("hostile / malformed seeds (QA #172)", () => {
  const FALLBACK = resolveThemeDeclarations(undefined);
  const HOSTILE: ReadonlyArray<[label: string, seed: unknown]> = [
    ["undefined", undefined],
    ["null", null],
    ["number", 42],
    ["NaN", NaN],
    ["empty object", {}],
    ["empty array", []],
    ["empty string", ""],
    ["whitespace only", "  \n\t "],
    ["5-digit hex", "#12345"],
    ["css-injection seed", 'red; } html { background: url("x") }'],
    ["script-injection seed", "</script><script>alert(1)</script>"],
    ["emoji", "🎨🧨"],
    ["multi-kilobyte string", "#".repeat(64 * 1024)],
    ["boxed String (typeof object)", new String("#c2410c")],
    [
      "object whose toString throws",
      {
        toString: (): string => {
          throw new Error("boom");
        },
      },
    ],
    ["symbol", Symbol("seed")],
    ["function", () => "#ffffff"],
    ["oklch with non-numeric channels", "oklch(NaN NaN NaN)"],
    ["rgb out of range / exponent", "rgb(999, -4, 1e99)"],
  ];

  for (const [label, seed] of HOSTILE) {
    it(`never throws and yields the complete token set — ${label}`, () => {
      let declarations: ThemeDeclaration[] = [];
      expect(() => {
        declarations = resolveThemeDeclarations(seed);
      }).not.toThrow();
      expect(declarations.map(([property]) => property)).toEqual(
        FALLBACK.map(([property]) => property),
      );
      for (const [, value] of declarations) {
        expect(value).toMatch(/^light-dark\(.+,.+\)$/);
      }
    });
  }

  it("unparseable seeds collapse to ONE deterministic fallback theme (no seed content leaks into values)", () => {
    expect(
      resolveThemeDeclarations("</script><script>alert(1)</script>"),
    ).toEqual(FALLBACK);
    expect(resolveThemeDeclarations("not-a-color")).toEqual(FALLBACK);
  });

  it("extreme-but-valid seeds (pure black / pure white) still resolve the full set", () => {
    for (const seed of ["#000", "#ffffff"]) {
      const declarations = resolveThemeDeclarations(seed);
      expect(declarations.map(([property]) => property)).toEqual(
        FALLBACK.map(([property]) => property),
      );
      for (const [, value] of declarations) {
        expect(value).toMatch(/^light-dark\(.+,.+\)$/);
      }
    }
  });
});

describe("themeInitScript injection path (QA #172)", () => {
  afterEach(() => document.documentElement.removeAttribute("style"));

  it("a script-injection seed cannot reach the baked script (engine-sanitized values only)", () => {
    const payload = "</script><script>alert(1)</script>";
    const script = themeInitScript(resolveThemeDeclarations(payload));
    expect(script.toLowerCase()).not.toContain("</script");
    expect(script.toLowerCase()).not.toContain("<script");
    expect(script).not.toContain("alert");
    expect(script).not.toContain("<!--");
  });

  it("declaration values carry none of the HTML/JS-dangerous characters for inline embedding", () => {
    // The injection-safety claim rests on this: engine values are numeric oklch literals.
    for (const seed of [ORANGE, BLUE, undefined, "</script>"]) {
      for (const [, value] of resolveThemeDeclarations(seed)) {
        expect(value).not.toMatch(/[<>&"'`\\\n\u2028\u2029]/u);
      }
    }
  });

  it("escapes HTML-dangerous sequences even for out-of-engine declarations (boundary hardening)", () => {
    // FAILING ON ARRIVAL — the defect this QA pass pins. `themeInitScript` is an exported
    // module boundary typed `ThemeDeclaration[]` (arbitrary strings), but its injection
    // safety is only a PRECONDITION stated in a comment (callers must pass engine output),
    // not a property the function enforces. Embedded in HTML via dangerouslySetInnerHTML,
    // a `</script` inside any value terminates the script element and the rest parses as
    // markup — XSS one future caller away (#178 feeds this same path). The industry-standard
    // fix is the one Next.js itself applies when inlining JSON into HTML: escape `<` (e.g.
    // as <) in the stringified payload.
    const script = themeInitScript([
      ["--x", "</script><script>alert(1)</script>"],
    ]);
    expect(script.toLowerCase()).not.toContain("</script");
  });

  it("an empty declaration set bakes a harmless, valid no-op script", () => {
    const script = themeInitScript([]);
    expect(() => new Function(script)()).not.toThrow();
    expect(document.documentElement.getAttribute("style")).toBeNull();
  });

  it("round-trips — executing the baked script stamps exactly what applyThemeDeclarations stamps", () => {
    const declarations = resolveThemeDeclarations(ORANGE);
    new Function(themeInitScript(declarations))();
    const scripted = document.documentElement.getAttribute("style");
    document.documentElement.removeAttribute("style");
    applyThemeDeclarations(declarations);
    expect(document.documentElement.getAttribute("style")).toBe(scripted);
    for (const [property, value] of declarations) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe(
        value,
      );
    }
  });
});

describe("applyThemeDeclarations edges (QA #172)", () => {
  afterEach(() => document.documentElement.removeAttribute("style"));

  it("an empty set is a no-op that leaves existing inline style untouched", () => {
    document.documentElement.style.colorScheme = "dark";
    applyThemeDeclarations([]);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.documentElement.style.length).toBe(1);
  });

  it("re-stamping with a different seed's full set leaves no stale property behind", () => {
    // The full-overwrite invariant, exercised end-to-end: every property the first seed
    // stamped is re-written by the second — nothing survives from the previous route.
    const first = resolveThemeDeclarations(ORANGE);
    const second = resolveThemeDeclarations(BLUE);
    applyThemeDeclarations(first);
    applyThemeDeclarations(second);
    const { style } = document.documentElement;
    for (const [property, value] of second) {
      expect(style.getPropertyValue(property)).toBe(value);
    }
    const orphaned = first.filter(
      ([property]) => !second.some(([p]) => p === property),
    );
    expect(orphaned).toEqual([]);
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
