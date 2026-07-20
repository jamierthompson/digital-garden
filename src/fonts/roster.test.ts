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

  // The `category` is what `EntryScope` tails after the face var as the terminal fallback (#255),
  // so it must be the face's OWN CSS generic family, verified against next's bundled
  // capsize-font-metrics.json (`category` field per family), not guessed from the name. A wrong
  // category ships a mismatched generic on every themed slot with no other signal.
  const EXPECTED_CATEGORY = {
    inter: "sans-serif",
    newsreader: "serif",
    fraunces: "serif",
    "space-grotesk": "sans-serif",
    "jetbrains-mono": "monospace",
  } as const;

  it.each(FONT_KEYS)(
    "%s carries its own verified CSS generic category",
    (key) => {
      expect(FONT_FACES[key].category).toBe(EXPECTED_CATEGORY[key]);
    },
  );

  it("gives every face a valid CSS generic keyword (a future face can't ship without one)", () => {
    const GENERICS = new Set(["serif", "sans-serif", "monospace"]);
    for (const key of FONT_KEYS) {
      expect(GENERICS.has(FONT_FACES[key].category)).toBe(true);
    }
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

  // `FONT_FACES` entries: key → { variable: <binding>.variable, cssVariable: <CONST>,
  // category: "<generic>" }. The `category` clause is required, so a face added without one
  // fails the parse-yield guard below rather than passing vacuously (#255).
  const faceEntries = [
    ...source.matchAll(
      /["']?([a-z0-9-]+)["']?:\s*\{\s*variable:\s*([a-zA-Z0-9]+)\.variable,\s*cssVariable:\s*([A-Z0-9_]+_VAR),\s*category:\s*"[^"]+"\s*,?\s*\}/g,
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

  // QA (font-palette): Newsreader now carries the WHOLE editorial voice — heading AND body — and
  // the home hero's emphasis + every display-grade heading lean on the SAME face. Two loader
  // axes make that legitimate rather than synthesized, and next/font only ships a variant it was
  // asked to load, so both are load-bearing and neither is covered anywhere else:
  //   • `style: [..., "italic"]` — the hero `<em>` (`src/app/page.tsx`) and the entry italic are
  //     Newsreader's TRUE italic; drop it and next/font ships upright-only and the browser
  //     synthesizes an oblique slant (the exact thing commit 0978e1f/4578edc claim is avoided).
  //   • `axes: ["opsz"]` — the display/text optical grades (`--type-display-*` vs `--type-body-*`
  //     in semantic/type.css) rely on the opsz axis tracking rendered size; without it every size
  //     renders the one default optical master.
  // The loader is mocked in this suite (next/font isn't transformed under Vitest), so these are
  // only assertable at the source — same posture as the preload/display pins above.
  it("Newsreader loads the true italic and the full optical-size axis (hero em + display grade)", () => {
    const newsreader = faceEntries.find((entry) => entry.key === "newsreader")!;
    const body = loaderBodies.get(newsreader.binding)!;
    expect(body, "Newsreader must request its true italic").toMatch(
      /style:\s*\[[^\]]*"italic"[^\]]*\]/,
    );
    expect(body, "Newsreader must request the opsz axis").toMatch(
      /axes:\s*\[[^\]]*"opsz"[^\]]*\]/,
    );
  });
});
