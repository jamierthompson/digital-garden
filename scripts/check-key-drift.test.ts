/**
 * Co-located test for the key-drift guard (scripts/check-key-drift.mjs) [D10].
 *
 * NODE-SAFE BY DESIGN: it runs the script as a child process and asserts on its
 * exit code + output. It NEVER imports the script (or any resolver/roster module,
 * which would pull in `next/font`); it only imports `node:*` and the contract
 * `keys.ts` indirectly via the spawned script. This file runs under the default
 * (jsdom) Vitest project only — it is outside the node project's engine glob — so
 * it executes exactly once.
 *
 * Two layers:
 *   • Happy path — the script run against the REAL repo passes (exit 0).
 *   • Drift detection — run against a throwaway FIXTURE tree (a copy of the script
 *     beside a deliberately-broken `keys.ts`/resolvers) and assert exit 1 with the
 *     right message. Fixtures keep the real source pristine.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

// `fileURLToPath(import.meta.url)` (string arg) avoids the URL global, whose jsdom
// variant Node's `fs`/`url` reject — this suite runs under the jsdom project. Same
// guard the harness test documents.
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "check-key-drift.mjs");

function run(cwdScript: string) {
  return spawnSync(process.execPath, [cwdScript], { encoding: "utf8" });
}

describe("check-key-drift.mjs — happy path (real repo)", () => {
  it("passes with exit 0 and reports the guards are wired", () => {
    const { status, stdout, stderr } = run(SCRIPT);
    expect(stderr).not.toMatch(/FAIL/);
    expect(stdout).toMatch(/key-drift: OK/);
    expect(stdout).toMatch(/satisfies` guards wired/);
    expect(status).toBe(0);
  });
});

describe("check-key-drift.mjs — drift detection (fixtures)", () => {
  const dirs: string[] = [];

  // Build a throwaway tree: scripts/<script>, src/lib/keys.ts, src/fonts/roster.ts,
  // src/lib/resolvers/{components,embeds}.ts — overriding only what each case needs.
  function fixture(overrides: {
    keys?: string;
    roster?: string;
    components?: string;
    embeds?: string;
  }): string {
    const base = mkdtempSync(join(tmpdir(), "key-drift-"));
    dirs.push(base);
    const write = (rel: string, body: string) => {
      const full = join(base, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, body);
    };

    // Copy the real script verbatim so we test the REAL logic against fake inputs.
    const realScript = spawnSync("cat", [SCRIPT], { encoding: "utf8" }).stdout;
    write("scripts/check-key-drift.mjs", realScript);

    write(
      "src/lib/keys.ts",
      overrides.keys ??
        `export const FONT_KEYS = ["inter"] as const;
         export const COMPONENT_KEYS = [] as const;
         export const EMBED_KEYS = [] as const;`,
    );
    write(
      "src/fonts/roster.ts",
      overrides.roster ??
        `export const FONT_FACES = {} satisfies Record<FontKey, FontFace>;`,
    );
    write(
      "src/lib/resolvers/components.ts",
      overrides.components ??
        `const PROJECT_LOADERS = {} satisfies Record<ComponentKey, ProjectLoader>;`,
    );
    write(
      "src/lib/resolvers/embeds.ts",
      overrides.embeds ??
        `const EMBED_LOADERS = {} satisfies Record<EmbedKey, EmbedLoader>;`,
    );

    return join(base, "scripts/check-key-drift.mjs");
  }

  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("a well-formed fixture passes (sanity check of the harness)", () => {
    const { status } = run(fixture({}));
    expect(status).toBe(0);
  });

  it("fails on a non-kebab-case key", () => {
    const script = fixture({
      keys: `export const FONT_KEYS = ["Inter"] as const;
             export const COMPONENT_KEYS = [] as const;
             export const EMBED_KEYS = [] as const;`,
    });
    const { status, stderr } = run(script);
    expect(status).toBe(1);
    expect(stderr).toMatch(/not kebab-case/);
  });

  it("fails on a duplicate key within an array", () => {
    const script = fixture({
      keys: `export const FONT_KEYS = ["inter", "inter"] as const;
             export const COMPONENT_KEYS = [] as const;
             export const EMBED_KEYS = [] as const;`,
    });
    const { status, stderr } = run(script);
    expect(status).toBe(1);
    expect(stderr).toMatch(/duplicate entry/);
  });

  it("fails on a key colliding across two arrays", () => {
    const script = fixture({
      keys: `export const FONT_KEYS = ["shared"] as const;
             export const COMPONENT_KEYS = ["shared"] as const;
             export const EMBED_KEYS = [] as const;`,
    });
    const { status, stderr } = run(script);
    expect(status).toBe(1);
    expect(stderr).toMatch(/unique across arrays/);
  });

  it("fails when a registry drops its `satisfies` guard (even if a comment keeps the phrase)", () => {
    const script = fixture({
      // The phrase survives in a comment, but the code annotation is gone — the
      // pattern requires `} satisfies`, so this must still FAIL.
      roster: `// satisfies Record<FontKey, FontFace> used to be here
               export const FONT_FACES = {};`,
    });
    const { status, stderr } = run(script);
    expect(status).toBe(1);
    expect(stderr).toMatch(/missing its compile-time guard/);
  });
});
