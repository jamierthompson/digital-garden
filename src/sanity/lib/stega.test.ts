import { describe, expect, it, vi } from "vitest";

import {
  STEGA_EXCLUDED_FIELDS,
  isStegaExcludedField,
  stegaFilter,
} from "./stega";

/**
 * The stega exclusion set is a correctness landmine, not cosmetics: the
 * code-consumed fields are parsed by the OKLCH engine, resolved by key, or compared
 * as discriminators, and stega's invisible chars break all three. This is
 * single-sourced here precisely so the published client and the Live base client can
 * never drift — so the test pins the exact set and the filter's two branches.
 */
describe("stega exclusions", () => {
  it("excludes exactly the code-consumed fields", () => {
    expect([...STEGA_EXCLUDED_FIELDS].sort()).toEqual(
      [
        "brandColor",
        "brandColorDark",
        "componentKey",
        "embedKey",
        "fontKey",
        "kind",
        "stage",
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

  it.each(["home", "browse", "about", "now", "system"])(
    "flags the pageThemes.%s seed via its ancestor (leaf names are common words)",
    (page) => {
      expect(isStegaExcludedField(["pageThemes", page])).toBe(true);
    },
  );

  it("does not flag a same-named prose field OUTSIDE pageThemes", () => {
    // `now` as a bare leaf (e.g. a hypothetical prose field) must NOT be excluded —
    // only seeds nested under the pageThemes ancestor are code-consumed.
    expect(isStegaExcludedField(["now"])).toBe(false);
    expect(isStegaExcludedField(["home"])).toBe(false);
  });

  // --- QA hardening (#173): the ancestor match is a global `.some(seg === "pageThemes")` ---

  it("excludes a seed when pageThemes is a DEEP ancestor, not the immediate parent", () => {
    // The `.some` scans the WHOLE path, so exclusion doesn't depend on pageThemes being the
    // direct parent — any depth counts.
    expect(isStegaExcludedField(["root", "pageThemes", "now"])).toBe(true);
  });

  it("tolerates numeric (array-index) segments in the path without throwing", () => {
    // Real source paths interleave numbers for array indices; the string-typed `.some`/`.has`
    // guards must skip them, not choke.
    expect(isStegaExcludedField(["pageThemes", 0, "now"])).toBe(true);
    expect(isStegaExcludedField(["body", 3, "children", 0, "text"])).toBe(
      false,
    );
  });

  it("still excludes a leaf-name field nested arbitrarily deep", () => {
    expect(isStegaExcludedField(["a", "b", "c", "brandColor"])).toBe(true);
  });

  it("does not over-match a segment that merely CONTAINS 'pageThemes' (exact match only)", () => {
    // Substring safety: a hypothetical sibling field like `pageThemesArchive` must NOT be
    // swept in — the ancestor set is matched by equality, not `includes`.
    expect(isStegaExcludedField(["pageThemesArchive", "title"])).toBe(false);
  });

  it("documents the intentional over-reach: ANY leaf under a pageThemes ancestor is excluded", () => {
    // A prose-named leaf (e.g. `title`) nested anywhere under pageThemes is still excluded —
    // the ancestor match is deliberately broad. Pinned so a future narrowing is a conscious change.
    expect(isStegaExcludedField(["pageThemes", "subgroup", "title"])).toBe(
      true,
    );
  });

  it("returns false (no crash) for an empty source path", () => {
    expect(isStegaExcludedField([])).toBe(false);
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
