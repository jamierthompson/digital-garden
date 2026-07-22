/**
 * Co-located test for the published-keys drift net (scripts/check-published-keys.mjs).
 *
 * `findUnresolvedKeys` is pure (no network, no process) and imported directly, unlike
 * check-key-drift.mjs's tests — this script pulls in no `next/font` chain, so a plain
 * import is safe. The network path itself is exercised only via child process, and only
 * for the graceful-degradation branch (missing env vars) — the suite must stay offline,
 * so it never spawns the script against the live dataset.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import {
  findBrokenQuerySignals,
  findUnresolvedKeys,
} from "./check-published-keys.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "check-published-keys.mjs");

describe("findUnresolvedKeys", () => {
  it("returns an empty array when every published key is known", () => {
    expect(
      findUnresolvedKeys(
        ["inter", "fraunces"],
        ["inter", "fraunces", "newsreader"],
      ),
    ).toEqual([]);
  });

  it("returns published keys with no match in the known set", () => {
    expect(findUnresolvedKeys(["inter", "retired-key"], ["inter"])).toEqual([
      "retired-key",
    ]);
  });

  it("returns nothing when the published side is empty", () => {
    expect(findUnresolvedKeys([], ["inter"])).toEqual([]);
  });

  it("flags every unresolved key, not just the first", () => {
    expect(findUnresolvedKeys(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });

  it("returns nothing when the known side is also empty (both sides vacuous)", () => {
    // Documents the sharp edge behind the vacuous-green finding: `findUnresolvedKeys`
    // cannot distinguish "genuinely zero published keys" from "the GROQ field path is
    // wrong and matched nothing" — both hand it `[]` and both come back clean. See the
    // QA report for a live repro (pointing the query at a renamed/bogus field still
    // resolves and exits 0). The safeguard this net is missing — asserting the query
    // actually reached real data — has to live in `main()`, not in this pure function.
    expect(findUnresolvedKeys([], [])).toEqual([]);
  });

  it("preserves duplicate unresolved entries rather than de-duping them", () => {
    // The production GROQ de-dupes with `array::unique` before this ever runs, but the
    // function itself has no such guarantee — pin the actual (duplicate-preserving)
    // behaviour so a future caller doesn't assume de-duplication that isn't there.
    expect(findUnresolvedKeys(["a", "a", "b"], ["b"])).toEqual(["a", "a"]);
  });

  it("is case-sensitive — a casing drift reads as an unresolved key", () => {
    expect(findUnresolvedKeys(["Inter"], ["inter"])).toEqual(["Inter"]);
  });

  it("is whitespace-sensitive — an untrimmed value reads as unresolved", () => {
    expect(findUnresolvedKeys([" inter"], ["inter"])).toEqual([" inter"]);
  });

  it("treats a null/undefined entry in the published array as unresolved, not a crash", () => {
    expect(findUnresolvedKeys([null, undefined, "inter"], ["inter"])).toEqual([
      null,
      undefined,
    ]);
  });

  it("flags every published key as unresolved when the known set is empty", () => {
    expect(findUnresolvedKeys(["inter", "fraunces"], [])).toEqual([
      "inter",
      "fraunces",
    ]);
  });

  it("throws (rather than silently passing) when the published side isn't an array", () => {
    // A renamed GROQ projection key (e.g. `fontKeys` -> `fontKeysRenamed` while
    // `main()` still reads `published.fontKeys`) hands this function `undefined`
    // instead of `[]`. It throws — a *loud*, uncaught crash (verified: exits the
    // process with a non-zero code and a stack trace) rather than a silent false-green.
    // That's the ONE query-shape mistake this net fails loudly on; a mistake that keeps
    // the projection key name but breaks the *filter inside it* does not (see the
    // vacuous-green finding) — array::unique() on a wrong/renamed field still resolves
    // to `[]`, which this function treats as "nothing to report".
    expect(() => findUnresolvedKeys(undefined, ["inter"])).toThrow(TypeError);
    expect(() => findUnresolvedKeys(null, ["inter"])).toThrow(TypeError);
  });
});

describe("findBrokenQuerySignals — the vacuous-green safeguard", () => {
  const CLEAN = {
    entryCount: 12,
    siteSettingsCount: 1,
    slotBlockCount: 3,
    fontKeys: ["inter"],
    componentKeys: ["some-module"],
    slotKeys: ["some-slot"],
  };

  it("returns no signals when every structural count and key array agree", () => {
    expect(findBrokenQuerySignals(CLEAN)).toEqual([]);
  });

  it("stays clean on a genuinely empty dataset", () => {
    // Every count — structural AND key — drops to zero together. The one guard (gated on
    // slotBlockCount > 0) does not fire.
    expect(
      findBrokenQuerySignals({
        entryCount: 0,
        siteSettingsCount: 0,
        slotBlockCount: 0,
        fontKeys: [],
        componentKeys: [],
        slotKeys: [],
      }),
    ).toEqual([]);
  });

  it("does NOT flag an empty componentKeys array — componentKey is optional everywhere (#226)", () => {
    // #226 deleted the `requiredForNonSketchProject` validator, so a prose-only evergreen entry
    // publishing zero componentKeys is legitimate content — componentKey now carries no schema
    // anchor (like the three faces), so an empty componentKeys array must NOT read as a broken
    // query. Regression guard for the componentKey-canary removal: the old canary false-red'd
    // exactly this dataset (a non-seedling entry with zero resolved componentKeys).
    expect(findBrokenQuerySignals({ ...CLEAN, componentKeys: [] })).toEqual([]);
  });

  it("does NOT flag an empty fontKeys array — the three faces are optional (#226), so no font canary", () => {
    // Every theme face is optional, so zero resolved font keys is a legitimate state (no entry
    // set any face) — indistinguishable from, and treated the same as, a benign empty. There is
    // no schema-required face to anchor a "should be non-empty" check, so removing the old
    // siteSettings.fontKey canary is correct. Regression guard for that removal.
    expect(findBrokenQuerySignals({ ...CLEAN, fontKeys: [] })).toEqual([]);
  });

  it("flags a broken slotKey path — a slot block exists but zero slotKeys resolved", () => {
    const signals = findBrokenQuerySignals({ ...CLEAN, slotKeys: [] });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatch(/slotKey query is likely broken/);
  });

  it("does NOT flag slotKey as broken when the dataset legitimately has no slots", () => {
    // No slot blocks is a valid content state (an all-notes or all-seedling garden) — the
    // structural count being zero must not read as breakage.
    expect(
      findBrokenQuerySignals({
        ...CLEAN,
        slotBlockCount: 0,
        slotKeys: [],
      }),
    ).toEqual([]);
  });

  it("counts only the slotKey break — empty fontKeys/componentKeys add no signal on top", () => {
    // slotKey is the ONLY remaining canary (fonts and componentKey are both optional, #226), so
    // even with all three arrays empty the signal list is exactly the one slotKey break — never
    // a fonts or componentKey signal.
    const signals = findBrokenQuerySignals({
      ...CLEAN,
      fontKeys: [],
      componentKeys: [],
      slotKeys: [],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatch(/slotKey query is likely broken/);
  });
});

/**
 * QA (#226 rework): the script's own comment claims the font query's shape "is pinned by this
 * script's unit test" — this suite is that pin; it did not exist before. Nothing else can catch
 * a typo'd face path: `array::unique()` on a wrong field resolves to `[]` with no error, and
 * #226 removed the font canary (every face is optional, so an empty array is legitimate). So
 * EXECUTE `PUBLISHED_KEYS_QUERY` with groq-js against a synthetic dataset and prove the three
 * `theme.*` face paths actually round-trip. The query is extracted from the module source —
 * it is deliberately not exported, and importing the module must stay side-effect-free.
 */
describe("PUBLISHED_KEYS_QUERY — executed GROQ semantics (QA #226 rework)", () => {
  const QUERY = readFileSync(SCRIPT, "utf8").match(
    /const PUBLISHED_KEYS_QUERY = `([\s\S]*?)`;/,
  )?.[1];

  // `body` is required only for EDITORIAL kinds — a demo carries none (its template is
  // sidebar + canvas), so the dataset legitimately contains body-less entries. Traversing an
  // absent `body` evaluates to null in GROQ, so the slotKeys rung filters to
  // `defined(body)` docs first; the body-less demo below pins that no spurious null
  // reaches the key list.
  const PROSE = [{ _type: "block", children: [] }];
  const DATASET = [
    {
      _id: "note-two-faces",
      _type: "entry",
      kind: "note",
      theme: {
        color: "#123456",
        headingFont: "fraunces",
        bodyFont: "newsreader",
      },
      body: PROSE,
    },
    {
      _id: "essay-evergreen",
      _type: "entry",
      kind: "essay",
      stage: "evergreen",
      componentKey: "color-engine",
      theme: {
        color: "#123456",
        bodyFont: "newsreader",
        monoFont: "jetbrains-mono",
      },
      body: [...PROSE, { _type: "slot", slotKey: "color-engine-seed" }],
    },
    {
      _id: "essay-seedling",
      _type: "entry",
      kind: "essay",
      stage: "seedling",
      theme: { color: "#123456" },
      body: PROSE,
    },
    {
      _id: "demo-no-body",
      _type: "entry",
      kind: "demo",
      stage: "budding",
      componentKey: "color-engine",
      theme: { color: "#123456" },
    },
    { _id: "settings", _type: "siteSettings" },
  ];

  async function runQuery(
    dataset: ReadonlyArray<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    expect(
      QUERY,
      "expected to extract PUBLISHED_KEYS_QUERY from the module source",
    ).toBeDefined();
    return (await (
      await evaluate(parse(QUERY!), { dataset: [...dataset] })
    ).get()) as Record<string, unknown>;
  }

  it("gathers ALL THREE theme faces into fontKeys, de-duplicated across entries", async () => {
    // `newsreader` is authored twice (two entries' bodyFont) → must appear once; the heading
    // and mono faces come from DIFFERENT entries → the three sub-queries all contribute.
    const result = await runQuery(DATASET);
    expect([...(result.fontKeys as string[])].sort()).toEqual([
      "fraunces",
      "jetbrains-mono",
      "newsreader",
    ]);
  });

  it("keeps componentKeys / slotKeys and the telemetry + slotKey-canary counts intact", async () => {
    const result = await runQuery(DATASET);
    expect(result.componentKeys).toEqual(["color-engine"]);
    expect(result.slotKeys).toEqual(["color-engine-seed"]);
    expect(result.entryCount).toBe(4);
    expect(result.siteSettingsCount).toBe(1);
    expect(result.slotBlockCount).toBe(1);
  });

  it("resolves fontKeys to [] (not an error) when no entry sets any face — the legitimate-empty state", async () => {
    const result = await runQuery([{ _id: "settings", _type: "siteSettings" }]);
    expect(result.fontKeys).toEqual([]);
  });
});

describe("check-published-keys.mjs — graceful degradation (no live network)", () => {
  it("SKIPs with exit 0 when Sanity env vars are absent", () => {
    // Delete (not blank) the vars — `env.ts` only treats `undefined` as missing, so a
    // present-but-empty string would sail past its check and hit createClient instead.
    const envWithoutSanity = { ...process.env };
    delete envWithoutSanity.NEXT_PUBLIC_SANITY_PROJECT_ID;
    delete envWithoutSanity.NEXT_PUBLIC_SANITY_DATASET;
    const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: envWithoutSanity,
    });
    expect(stderr).not.toMatch(/FAIL/);
    expect(stdout).toMatch(/check-published-keys: SKIP/);
    expect(status).toBe(0);
  });
});
