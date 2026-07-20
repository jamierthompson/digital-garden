import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `cardSwatches` is RETIRED (one seed paints a page — a card no longer runs its own engine
 * solve). Its module and its test are deleted; this file replaces the deleted
 * `cardSwatches.test.ts` with the one guarantee that outlives the module: nothing in the repo
 * still points at it.
 *
 * This matters more than ordinary tidiness here. The engine package's README documents
 * `cardSwatches` as a live CONSUMER of `buildTokenSet` — including a whole section addressed to
 * "cardSwatches consumers" and a release rule about updating it in the same PR. An agent or
 * engineer reading that doc is told to maintain a module that no longer exists, and the
 * repo's docs-are-the-current-truth rule makes that a defect, not a cosmetic leftover.
 */

const ROOT = resolve(process.cwd());
const RETIRED_SYMBOL = "cardSwatches";

/** Tracked files worth scanning: prose and code, excluding this guard itself. */
function trackedFiles(): string[] {
  const out = execFileSync("git", ["ls-files"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((f) => /\.(md|ts|tsx|js|jsx|mjs|cjs|css)$/i.test(f))
    .filter((f) => !f.endsWith("src/lib/cardSwatches.retired.test.ts"));
}

describe("cardSwatches is retired", () => {
  it("the module and its test are gone from the tree", () => {
    expect(existsSync(resolve(ROOT, "src/lib/cardSwatches.ts"))).toBe(false);
    expect(existsSync(resolve(ROOT, "src/lib/cardSwatches.test.ts"))).toBe(
      false,
    );
  });

  it("no tracked file still cites the retired module", () => {
    const citations: string[] = [];
    for (const file of trackedFiles()) {
      const text = readFileSync(resolve(ROOT, file), "utf8");
      text.split("\n").forEach((line, i) => {
        if (line.includes(RETIRED_SYMBOL)) {
          citations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(citations).toEqual([]);
  });
});
