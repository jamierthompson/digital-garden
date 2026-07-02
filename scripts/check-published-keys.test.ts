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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
    projectEntryCount: 6,
    liveEmbedBlockCount: 3,
    fontKeys: ["inter"],
    componentKeys: ["engine-board"],
    embedKeys: ["sunrise-meter"],
  };

  it("returns no signals when every structural count and key array agree", () => {
    expect(findBrokenQuerySignals(CLEAN)).toEqual([]);
  });

  it("stays clean on a genuinely empty dataset (e.g. post-#109 mock-data purge)", () => {
    // Every count — structural AND key — drops to zero together. None of the guards
    // (each gated on its structural count being > 0) should fire.
    expect(
      findBrokenQuerySignals({
        entryCount: 0,
        siteSettingsCount: 0,
        projectEntryCount: 0,
        liveEmbedBlockCount: 0,
        fontKeys: [],
        componentKeys: [],
        embedKeys: [],
      }),
    ).toEqual([]);
  });

  it("flags a broken fontKey path — siteSettings published but zero fontKeys resolved", () => {
    const signals = findBrokenQuerySignals({ ...CLEAN, fontKeys: [] });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatch(/fontKey query is likely broken/);
  });

  it("flags a broken componentKey path — a project entry exists but zero componentKeys resolved", () => {
    const signals = findBrokenQuerySignals({ ...CLEAN, componentKeys: [] });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatch(/componentKey query is likely broken/);
  });

  it("flags a broken embedKey path — a liveEmbed block exists but zero embedKeys resolved", () => {
    const signals = findBrokenQuerySignals({ ...CLEAN, embedKeys: [] });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatch(/embedKey query is likely broken/);
  });

  it("does NOT flag componentKey/embedKey as broken when the dataset legitimately has none", () => {
    // No published project entries and no liveEmbed blocks is a valid content state (e.g.
    // an all-notes garden) — the structural counts being zero must not read as breakage.
    expect(
      findBrokenQuerySignals({
        ...CLEAN,
        projectEntryCount: 0,
        liveEmbedBlockCount: 0,
        componentKeys: [],
        embedKeys: [],
      }),
    ).toEqual([]);
  });

  it("reports every broken category at once, not just the first", () => {
    const signals = findBrokenQuerySignals({
      ...CLEAN,
      fontKeys: [],
      componentKeys: [],
      embedKeys: [],
    });
    expect(signals).toHaveLength(3);
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
