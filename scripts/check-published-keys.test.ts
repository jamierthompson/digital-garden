/**
 * Co-located test for the published-keys drift net (scripts/check-published-keys.mjs).
 *
 * `findUnresolvedKeys` is pure (no network, no process) and imported directly, unlike
 * check-key-drift.mjs's tests — this script pulls in no `next/font` chain, so a plain
 * import is safe. The GROQ query is exercised offline by evaluating it with `groq-js`
 * against an in-memory dataset (no network, no CDN) — the same pattern as
 * src/sanity/lib/queries.test.ts. The only child-process spawn is the graceful-degradation
 * branch (missing env vars); the suite never spawns the script against the live dataset.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";

import {
  findBrokenQuerySignals,
  findUnresolvedKeys,
  PUBLISHED_KEYS_QUERY,
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
    nonSketchProjectCount: 6,
    liveEmbedBlockCount: 3,
    fontKeys: ["inter"],
    componentKeys: ["some-module"],
    embedKeys: ["some-embed"],
  };

  it("returns no signals when every structural count and key array agree", () => {
    expect(findBrokenQuerySignals(CLEAN)).toEqual([]);
  });

  it("stays clean on a genuinely empty dataset", () => {
    // Every count — structural AND key — drops to zero together. None of the guards
    // (each gated on its structural count being > 0) should fire.
    expect(
      findBrokenQuerySignals({
        entryCount: 0,
        siteSettingsCount: 0,
        nonSketchProjectCount: 0,
        liveEmbedBlockCount: 0,
        fontKeys: [],
        componentKeys: [],
        embedKeys: [],
      }),
    ).toEqual([]);
  });

  it("stays clean on an all-sketch garden — sketch projects carry no componentKey (#109)", () => {
    // The live post-swap state: published project entries exist but they're all `stage:
    // sketch`, so componentKey is legitimately absent. The canary counts only NON-sketch
    // projects, so `nonSketchProjectCount` is zero and the empty componentKeys array is
    // correctly read as benign, not a broken query. (Regression guard for the schema
    // relaxation that made componentKey required only past the sketch stage.)
    expect(
      findBrokenQuerySignals({
        entryCount: 8,
        siteSettingsCount: 1,
        nonSketchProjectCount: 0,
        liveEmbedBlockCount: 0,
        fontKeys: ["fraunces"],
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

  it("flags a broken componentKey path — a non-sketch project exists but zero componentKeys resolved", () => {
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
    // No published non-sketch project entries and no liveEmbed blocks is a valid content
    // state (an all-notes or all-sketch garden) — the structural counts being zero must not
    // read as breakage.
    expect(
      findBrokenQuerySignals({
        ...CLEAN,
        nonSketchProjectCount: 0,
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

describe("PUBLISHED_KEYS_QUERY — source-text canary", () => {
  it("guards embedKeys against body-less entries with a `defined(body)` document filter", () => {
    // A cheap spelling guard that fails fast if the filter is deleted from the source, without
    // parsing or executing the query. It complements — does not replace — the executed groq-js
    // behavioral tests below, which are what actually prove the guard works. `body` is
    // schema-optional: a title-only entry (e.g. a now-update) is a valid, intended shape, so
    // its null `.body` must not leak into the flatten (the #217 false-fail).
    expect(PUBLISHED_KEYS_QUERY).toContain('_type == "entry" && defined(body)');
  });

  it("keeps the document-level `defined(...)` guard on every key line", () => {
    expect(PUBLISHED_KEYS_QUERY).toContain("defined(fontKey)");
    expect(PUBLISHED_KEYS_QUERY).toContain("defined(componentKey)");
    expect(PUBLISHED_KEYS_QUERY).toContain("defined(body)");
  });
});

describe("PUBLISHED_KEYS_QUERY — executed GROQ semantics (groq-js, offline; QA)", () => {
  // The slice's own comment calls the GROQ "not unit-testable" and settles for a string
  // canary — but `groq-js` (the reference evaluator Sanity's CDN runs) is a declared
  // devDependency already used this way in src/sanity/lib/queries.test.ts. Executing the
  // ACTUAL query against a synthetic dataset tests the *behavior* the fix claims, not the
  // *spelling* of the source; it is what would have caught #217 in the first place, and it
  // stays fully offline (in-memory dataset, no network). Schema facts pinned:
  // studio/schemaTypes/documents/entry.ts (`body` is optional) and
  // studio/schemaTypes/objects/liveEmbed.ts (`embedKey` is required).

  /** Run the production query against an in-memory dataset — no network, no token. */
  async function runQuery(dataset: unknown[]): Promise<{
    entryCount: number;
    liveEmbedBlockCount: number;
    fontKeys: unknown[];
    componentKeys: unknown[];
    embedKeys: unknown[];
  }> {
    const result = await (
      await evaluate(parse(PUBLISHED_KEYS_QUERY), { dataset })
    ).get();
    return result as {
      entryCount: number;
      liveEmbedBlockCount: number;
      fontKeys: unknown[];
      componentKeys: unknown[];
      embedKeys: unknown[];
    };
  }

  // A dataset that exercises every `body` shape a title-only garden can hold, alongside two
  // entries that carry real liveEmbed blocks. This is the #217 shape: body-less entries
  // sitting next to embed-bearing ones in the same flatten.
  const MIXED_DATASET: unknown[] = [
    {
      _type: "entry",
      _id: "e1",
      body: [{ _type: "liveEmbed", embedKey: "demo-a" }],
    },
    { _type: "entry", _id: "e2-title-only" }, // body absent (the #217 shape)
    { _type: "entry", _id: "e3-body-null", body: null }, // body explicitly null
    { _type: "entry", _id: "e4-body-empty", body: [] }, // defined but empty
    {
      _type: "entry",
      _id: "e5",
      body: [
        { _type: "liveEmbed", embedKey: "demo-b" },
        { _type: "block", children: [] },
      ],
    },
    { _type: "siteSettings", _id: "settings", fontKey: "inter" },
  ];

  it("collects real embedKeys and leaks NO null when body-less entries sit in the flatten (#217)", async () => {
    const { embedKeys } = await runQuery(MIXED_DATASET);
    // The core regression: the pre-fix query flattened absent/null `.body` into the array
    // as `null` — here it produced ["demo-a", null, null, "demo-b"]. The fix drops those
    // documents at the source, leaving only the real keys.
    expect(embedKeys).toEqual(["demo-a", "demo-b"]);
    expect(embedKeys).not.toContain(null);
  });

  it("produces zero FALSE drift end-to-end — the null never reaches findUnresolvedKeys (#217)", async () => {
    // The money test: this is exactly the pipeline main() runs. Pre-fix, the leaked nulls
    // arrived here as unresolved keys and the guard exited 1 — the false-fail. Post-fix the
    // published set is clean, so a known-set covering the real keys yields no drift.
    const { embedKeys } = await runQuery(MIXED_DATASET);
    expect(findUnresolvedKeys(embedKeys, ["demo-a", "demo-b"])).toEqual([]);
  });

  it("keeps liveEmbedBlockCount and embedKeys consistent — defined(body) desyncs neither", async () => {
    // The canary pair in findBrokenQuerySignals only holds if the count and the keys agree.
    // A body-less entry contributes 0 to BOTH (no body → no liveEmbed block, and dropped by
    // defined(body)), so the pairing stays sound on a mixed dataset.
    const published = await runQuery(MIXED_DATASET);
    expect(published.liveEmbedBlockCount).toBe(2);
    expect(published.embedKeys).toHaveLength(2);
    expect(findBrokenQuerySignals(published)).toEqual([]);
  });

  it("a title-only garden (every entry body-less) resolves to an empty embedKeys with no null and no broken signal", async () => {
    const published = await runQuery([
      { _type: "entry", _id: "n1" },
      { _type: "entry", _id: "n2", body: null },
      { _type: "entry", _id: "n3", body: [] },
    ]);
    expect(published.embedKeys).toEqual([]);
    expect(published.liveEmbedBlockCount).toBe(0);
    expect(findBrokenQuerySignals(published)).toEqual([]);
  });

  it("does not regress the sibling fontKey/componentKey flattens on the same dataset", async () => {
    const published = await runQuery([
      ...MIXED_DATASET,
      {
        _type: "entry",
        _id: "proj",
        kind: "project",
        stage: "shipped",
        fontKey: "newsreader",
        componentKey: "mod-x",
        body: [{ _type: "liveEmbed", embedKey: "demo-c" }],
      },
    ]);
    expect(published.fontKeys).toContain("inter");
    expect(published.fontKeys).toContain("newsreader");
    expect(published.componentKeys).toEqual(["mod-x"]);
    expect(published.embedKeys).toContain("demo-c");
    expect(published.embedKeys).not.toContain(null);
  });

  it("stays empty (not broken) on a genuinely empty dataset", async () => {
    const published = await runQuery([]);
    expect(published.entryCount).toBe(0);
    expect(published.embedKeys).toEqual([]);
    expect(findBrokenQuerySignals(published)).toEqual([]);
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
