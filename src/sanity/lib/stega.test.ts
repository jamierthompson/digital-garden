import { describe, expect, it, vi } from "vitest";

import {
  STEGA_EXCLUDED_FIELDS,
  isStegaExcludedField,
  stegaFilter,
} from "./stega";

/**
 * The stega exclusion set is a correctness landmine, not cosmetics: the five
 * code-consumed fields are parsed by the OKLCH engine or resolved by key, and stega's
 * invisible chars break both. This is single-sourced here precisely so the published
 * client and the Live base client can never drift — so the test pins the exact set and
 * the filter's two branches.
 */
describe("stega exclusions", () => {
  it("excludes exactly the five code-consumed fields", () => {
    expect([...STEGA_EXCLUDED_FIELDS].sort()).toEqual(
      [
        "brandColor",
        "brandColorDark",
        "componentKey",
        "embedKey",
        "fontKey",
      ].sort(),
    );
  });

  it.each([
    "brandColor",
    "brandColorDark",
    "fontKey",
    "componentKey",
    "embedKey",
  ])("flags %s (the leaf of the source path) as excluded", (field) => {
    expect(isStegaExcludedField(["someParent", field])).toBe(true);
  });

  it("does not flag prose fields like title/blurb/essay", () => {
    expect(isStegaExcludedField(["title"])).toBe(false);
    expect(isStegaExcludedField(["blurb"])).toBe(false);
    expect(isStegaExcludedField(["essay", 0, "children", 0, "text"])).toBe(
      false,
    );
  });
});

describe("stegaFilter", () => {
  it("returns false (skip encoding) for an excluded field, without consulting the default", () => {
    const filterDefault = vi.fn(() => true);
    const result = stegaFilter({
      sourcePath: ["brandColor"],
      filterDefault,
      // The remaining FilterDefault props are unused by our branch; cast for the test.
    } as unknown as Parameters<typeof stegaFilter>[0]);

    expect(result).toBe(false);
    expect(filterDefault).not.toHaveBeenCalled();
  });

  it("delegates to Sanity's default denylist for non-excluded fields", () => {
    const filterDefault = vi.fn(() => true);
    const props = {
      sourcePath: ["title"],
      filterDefault,
    } as unknown as Parameters<typeof stegaFilter>[0];

    const result = stegaFilter(props);

    expect(result).toBe(true);
    expect(filterDefault).toHaveBeenCalledWith(props);
  });
});
