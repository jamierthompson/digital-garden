import {
  stegaEncodeSourceMap,
  vercelStegaCleanAll,
} from "@sanity/client/stega";
import { describe, expect, it } from "vitest";

import { STEGA_EXCLUDED_FIELDS, stegaFilter } from "./stega";

/**
 * END-TO-END stega proof for the landmine, complementary to the unit tests in
 * `stega.test.ts`.
 *
 * `stega.test.ts` proves our `stegaFilter` *returns* `false` for the code-consumed
 * fields — but it mocks `filterDefault`, so it never proves the REAL `@sanity/client`
 * stega encoder actually honors that `false` and leaves the value byte-clean. That is
 * the property the OKLCH engine and the key resolvers depend on: a single stega
 * zero-width char in a `theme.color` / `theme.bodyFont` / `componentKey` value breaks the
 * color parse or the key lookup.
 *
 * This drives the genuine encoder (`stegaEncodeSourceMap`, the same function
 * `@sanity/client`'s `_fetch` calls when `stega.enabled`) through our actual
 * `stegaFilter`, and asserts:
 *  - every excluded field comes out byte-IDENTICAL to its input (no encoding), and
 *  - a non-excluded prose field DOES get encoded (proving the filter isn't just
 *    globally disabling stega — exclusions are surgical).
 *
 * A value "carries stega" iff stripping stega chars changes it (`vercelStegaCleanAll`).
 */
describe("stega encoding honors the exclusions end-to-end", () => {
  // One prose field (`title`) + every excluded field, each a distinct document path.
  const prose = { title: "First Light" };
  const excluded = Object.fromEntries(
    [...STEGA_EXCLUDED_FIELDS].map((field) => [field, `value-of-${field}`]),
  ) as Record<string, string>;
  const result: Record<string, string> = { ...prose, ...excluded };

  const fields = Object.keys(result);
  const sourceMap = {
    documents: [{ _id: "entry-1", _type: "entry" }],
    paths: fields.map((f) => `$['${f}']`),
    mappings: Object.fromEntries(
      fields.map((f, i) => [
        `$['${f}']`,
        {
          source: { type: "documentValue", document: 0, path: i },
          type: "value",
        },
      ]),
    ),
  };

  // Encode once with our real filter + stega enabled (the draft-perspective config).
  const encoded = stegaEncodeSourceMap(
    result,
    sourceMap as unknown as Parameters<typeof stegaEncodeSourceMap>[1],
    {
      enabled: true,
      studioUrl: "https://studio.example.test",
      filter: stegaFilter,
    } as unknown as Parameters<typeof stegaEncodeSourceMap>[2],
  ) as Record<string, string>;

  const carriesStega = (value: string) => value !== vercelStegaCleanAll(value);

  it("sanity-checks the fixture: a prose field IS encoded with stega on", () => {
    // If this fails the fixture is wrong (encoder never ran), not the filter.
    expect(carriesStega(encoded.title)).toBe(true);
  });

  it.each([...STEGA_EXCLUDED_FIELDS])(
    "leaves %s byte-clean (no stega chars) so code can parse/resolve it",
    (field) => {
      expect(carriesStega(encoded[field])).toBe(false);
      expect(encoded[field]).toBe(result[field]);
    },
  );
});

/**
 * The entry's `theme` object is excluded by ANCESTOR, not by leaf name — so this drives the real
 * encoder through a NESTED `theme.color` / `theme.bodyFont` path and proves the ancestor rule
 * leaves both byte-clean, while a prose sibling at the same depth still gets encoded.
 */
describe("stega encoding excludes the theme object by ancestor end-to-end", () => {
  const doc = {
    theme: { color: "#4f46e5", bodyFont: "newsreader" },
    caption: "A themed slot",
  };
  const paths = [
    "$['theme']['color']",
    "$['theme']['bodyFont']",
    "$['caption']",
  ];
  const sourceMap = {
    documents: [{ _id: "entry-1", _type: "entry" }],
    paths,
    mappings: Object.fromEntries(
      paths.map((p, i) => [
        p,
        {
          source: { type: "documentValue", document: 0, path: i },
          type: "value",
        },
      ]),
    ),
  };

  const encoded = stegaEncodeSourceMap(
    doc,
    sourceMap as unknown as Parameters<typeof stegaEncodeSourceMap>[1],
    {
      enabled: true,
      studioUrl: "https://studio.example.test",
      filter: stegaFilter,
    } as unknown as Parameters<typeof stegaEncodeSourceMap>[2],
  ) as typeof doc;

  const carriesStega = (value: string) => value !== vercelStegaCleanAll(value);

  it("sanity-checks the fixture: the prose sibling `caption` IS encoded", () => {
    expect(carriesStega(encoded.caption)).toBe(true);
  });

  it("leaves theme.color byte-clean (ancestor exclusion) so the OKLCH engine can parse it", () => {
    expect(carriesStega(encoded.theme.color)).toBe(false);
    expect(encoded.theme.color).toBe(doc.theme.color);
  });

  it("leaves theme.bodyFont byte-clean (ancestor exclusion) so the roster can resolve it", () => {
    expect(carriesStega(encoded.theme.bodyFont)).toBe(false);
    expect(encoded.theme.bodyFont).toBe(doc.theme.bodyFont);
  });
});
