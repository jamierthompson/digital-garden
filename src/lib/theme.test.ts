import { buildTokenSet, tokenSetToDeclarations } from "@garden/oklch";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyThemeDeclarations,
  resolveThemeDeclarations,
  tokenSetToThemeDeclarations,
  type ThemeDeclaration,
} from "./theme";

const ORANGE = "#c2410c";
const BLUE = "#1d4ed8";

// The semantic role names components actually read — the generic contract the engine themes
// and `semantic/color.css` binds as the engine fallback token set.
const CORE_ROLES = [
  "--surface",
  "--accent",
  "--foreground",
  "--accent-foreground",
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

describe("tokenSetToThemeDeclarations", () => {
  it("produces the SAME declarations as resolveThemeDeclarations for a seed's default token set", () => {
    // The client play path holds a live token set and stamps it directly; the server bakes from
    // the raw seed. Both must land byte-identical declarations, or the ephemeral `/color-engine`
    // re-stamp would drift from the authored theme it replaces.
    expect(tokenSetToThemeDeclarations(buildTokenSet(ORANGE))).toEqual(
      resolveThemeDeclarations(ORANGE),
    );
  });

  it("reflects the token set it is handed — a rules-treated set themes differently", () => {
    // Why the play path passes `palette.tokenSet` (rules-/gamut-treated), not the raw seed:
    // rule choices must reach the whole-page repaint. Dropping the neutral tint moves the
    // neutral-derived surfaces.
    const tinted = tokenSetToThemeDeclarations(
      buildTokenSet(ORANGE, { rules: { tintedNeutrals: true } }),
    );
    const flat = tokenSetToThemeDeclarations(
      buildTokenSet(ORANGE, { rules: { tintedNeutrals: false } }),
    );
    expect(Object.fromEntries(tinted)["--surface"]).not.toBe(
      Object.fromEntries(flat)["--surface"],
    );
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

// --- Adversarial QA (#172): the engine↔parser coupling, hostile seeds, and the injection
// path. `parseDeclarations` is private by design, so every pin runs through the public
// wrapper against the engine's REAL output — if the engine's serialization format drifts
// (multi-decl lines, a changed joiner, a new non-custom-property line), these fail HERE
// instead of shipping a silently-collapsed theme.
//
// NOT a frozen contract. `@garden/oklch` is an internal, project-only package — digital-garden
// is its ONLY consumer — so any of its contracts may be changed or broken at will, up to and
// including a major-version bump for a new feature. These pins exist ONLY to stop the engine and
// this parser drifting apart *silently* while features are built in parallel. If you deliberately
// change the engine's serialization format, UPDATE this pin to match — it is a tripwire against
// accidental drift, never a reason not to change the engine. ---

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

  // QA #334: the invariant above is deliberately count-agnostic, so it stayed green when the
  // contract grew 38 → 59. Pin the delivered list to the engine's own name list, so a token
  // that the engine emits but the parser drops (a value the line/colon split mangles — the
  // harmony names are the longest and most hyphenated in the contract) fails HERE rather than
  // as a missing color on the page.
  it("delivers EVERY engine token name, harmony blocks included, for every seed", () => {
    const engineNames = tokenSetToDeclarations(buildTokenSet(ORANGE))
      .split("\n")
      .map((line) => line.slice(0, line.indexOf(":")).trim())
      .filter((name) => name.startsWith("--"));

    for (const seed of [ORANGE, BLUE, "not-a-color", undefined]) {
      const delivered = resolveThemeDeclarations(seed).map(([name]) => name);
      expect([...delivered].sort(), String(seed)).toEqual(
        [...engineNames].sort(),
      );
    }

    const delivered = new Set(
      resolveThemeDeclarations(ORANGE).map(([name]) => name),
    );
    for (const hue of [
      "analogous-a",
      "analogous-b",
      "complementary",
      "triadic-a",
      "triadic-b",
      "split-complementary-a",
      "split-complementary-b",
    ]) {
      for (const suffix of ["", "-fill", "-text"]) {
        expect(delivered.has(`--harmony-${hue}${suffix}`)).toBe(true);
      }
    }
  });

  // The harmony names are the first in the contract where one token name is a strict PREFIX
  // of another (`--harmony-triadic-a` / `--harmony-triadic-a-fill`). Any consumer that
  // matches by prefix rather than by exact name collapses them; assert the parser kept all
  // three distinct, with distinct values.
  it("keeps prefix-overlapping harmony names distinct (no longest-match collapse)", () => {
    const map = Object.fromEntries(resolveThemeDeclarations(ORANGE));
    const anchor = map["--harmony-triadic-a"];
    const fill = map["--harmony-triadic-a-fill"];
    const text = map["--harmony-triadic-a-text"];
    for (const [name, value] of [
      ["anchor", anchor],
      ["fill", fill],
      ["text", text],
    ] as const) {
      expect(value, name).toBeDefined();
      expect(value, name).toContain("light-dark(");
    }
    expect(new Set([anchor, fill, text]).size).toBe(3);
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
  it("resolveThemeDeclarations + tokenSetToThemeDeclarations run with no DOM globals (server-safe)", () => {
    // The pure half of the module must not touch the DOM — only applyThemeDeclarations does.
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    try {
      const declarations = resolveThemeDeclarations(ORANGE);
      expect(declarations.length).toBeGreaterThan(0);
      expect(Object.fromEntries(declarations)["--accent"]).toContain(
        "light-dark(",
      );
      expect(tokenSetToThemeDeclarations(buildTokenSet(ORANGE))).toEqual(
        declarations,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
