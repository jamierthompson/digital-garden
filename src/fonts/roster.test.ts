import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

// Under Vitest next/font/google isn't transformed by the Next plugin, so the real loaders
// throw ("Inter is not a function"). Mock each face to return just the `.variable` className.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import { FONT_KEYS } from "@/lib/keys";

import { FONT_FACES } from "./roster";

describe("font roster", () => {
  it("maps every FontKey to a face (no gaps, no extras)", () => {
    expect(Object.keys(FONT_FACES).sort()).toEqual([...FONT_KEYS].sort());
  });

  it("exposes a variable className and a --font-* CSS variable per face", () => {
    for (const key of FONT_KEYS) {
      const face = FONT_FACES[key];
      expect(face.variable).toBeTruthy();
      expect(face.cssVariable).toMatch(/^--font-/);
    }
  });

  it("binds each face's cssVariable to the matching key", () => {
    expect(FONT_FACES.inter.cssVariable).toBe("--font-inter");
    expect(FONT_FACES["space-grotesk"].cssVariable).toBe(
      "--font-space-grotesk",
    );
    expect(FONT_FACES["jetbrains-mono"].cssVariable).toBe(
      "--font-jetbrains-mono",
    );
    expect(FONT_FACES.newsreader.cssVariable).toBe("--font-newsreader");
    expect(FONT_FACES.fraunces.cssVariable).toBe("--font-fraunces");
  });
});

/**
 * Source-level guards. next/font is mocked above (untransformed under Vitest), so nothing
 * at runtime can verify what the REAL loader calls declare — and both invariants below fail
 * silently in production if they drift:
 *
 *  1. **Loader `variable:` literal ↔ `*_VAR` const agreement.** next/font requires the
 *     loader's `variable:` to be a written literal, so each `*_VAR` const is repeated by
 *     hand inside its loader call. If the two diverge, the mounted `.variable` class
 *     declares one custom property while `FONT_FACES.cssVariable` (what `EntryScope` emits
 *     `var(…)` for) names another — the override resolves to nothing and the slot silently
 *     renders the bare generic. `roster.ts` relies on this suite to hold the two together.
 *  2. **The roster preload policy.** Every roster face must stay `preload: false` +
 *     `display: "swap"`; a single flipped face re-adds a below-fold font preload on every
 *     route (the trap the font policy exists to prevent) with zero test or lint signal.
 */
describe("roster.ts loader declarations (source-pinned)", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/fonts/roster.ts"),
    "utf8",
  );

  // `const FOO_VAR = "--font-foo";`
  const varConsts = new Map(
    [...source.matchAll(/const\s+([A-Z0-9_]+_VAR)\s*=\s*"([^"]+)"/g)].map(
      (m) => [m[1], m[2]],
    ),
  );

  // `const foo = Loader({ … });` → binding name → options-object source text.
  const loaderBodies = new Map(
    [
      ...source.matchAll(
        /const\s+([a-zA-Z0-9]+)\s*=\s*[A-Z][A-Za-z0-9_]*\(\{([\s\S]*?)\}\);/g,
      ),
    ]
      .filter(([, name]) => !varConsts.has(name))
      .map((m) => [m[1], m[2]]),
  );

  // `FONT_FACES` entries: key → { variable: <binding>.variable, cssVariable: <CONST> }.
  const faceEntries = [
    ...source.matchAll(
      /["']?([a-z0-9-]+)["']?:\s*\{\s*variable:\s*([a-zA-Z0-9]+)\.variable,\s*cssVariable:\s*([A-Z0-9_]+_VAR)\s*,?\s*\}/g,
    ),
  ].map(([, key, binding, varConst]) => ({ key, binding, varConst }));

  it("parses one loader + one FONT_FACES entry per FontKey (guards the guard)", () => {
    // If a refactor changes the source shape these regexes match nothing and every
    // assertion below would pass vacuously — pin the parse yield to the key count first.
    expect(faceEntries.map((entry) => entry.key).sort()).toEqual(
      [...FONT_KEYS].sort(),
    );
    expect(loaderBodies.size).toBe(FONT_KEYS.length);
  });

  it.each(FONT_KEYS)(
    "%s: the loader's `variable:` literal equals its *_VAR const (what EntryScope emits var() for)",
    (key) => {
      const entry = faceEntries.find((candidate) => candidate.key === key)!;
      const body = loaderBodies.get(entry.binding);
      expect(
        body,
        `expected a loader call bound to ${entry.binding}`,
      ).toBeDefined();
      const literal = body!.match(/variable:\s*"([^"]+)"/)?.[1];
      expect(literal).toBe(varConsts.get(entry.varConst));
    },
  );

  it.each(FONT_KEYS)(
    '%s: stays `preload: false` + `display: "swap"` (the roster policy)',
    (key) => {
      const entry = faceEntries.find((candidate) => candidate.key === key)!;
      const body = loaderBodies.get(entry.binding)!;
      expect(body).toMatch(/preload:\s*false/);
      expect(body).not.toMatch(/preload:\s*true/);
      expect(body).toMatch(/display:\s*"swap"/);
    },
  );
});
