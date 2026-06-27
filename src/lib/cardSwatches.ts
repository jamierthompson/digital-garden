/**
 * `cardSwatches(brandColor)` — engine Consumer C (§3.2, §6).
 *
 * Derives a small bag of inline CSS custom properties (`--c-*`) from a project's
 * `brandColor` for the `/work` index cards — no project scope, no `<style>` tag, no
 * class. A CONSUMER of the OKLCH engine, not part of it, so it lives in `src/lib/`
 * rather than inside the `@garden/oklch` package (§3.2) [D23].
 *
 * Total and defensive [D9]: delegates to `buildTokenSet`, which on bad/missing/hostile
 * input returns the safe fallback palette — so this NEVER throws and always returns a
 * valid swatch object. Values are BAKED `light-dark(<light oklch()>, <dark oklch()>)`
 * literals (as in the engine's `css.ts`), so a card reads correctly in both schemes
 * with zero runtime color math in the browser [D3, D5].
 *
 * The four stops are the minimum a self-themed card needs to stand apart on the shared
 * `/work` grid: `--c-surface` (tinted background), `--c-border` (contrast-solved
 * hairline), `--c-text` (AA-clearing label text), `--c-accent` (brand pop). They map
 * 1:1 onto engine tokens, so the colors match what the full project scope would use.
 */

import {
  buildTokenSet,
  formatOklch,
  type BrandTokenName,
  type EngineOptions,
  type SchemePair,
} from "@garden/oklch";

/** The card swatch custom-property names — the `--c-*` inline contract. */
export type CardSwatchVar =
  | "--c-surface"
  | "--c-border"
  | "--c-text"
  | "--c-accent";

/** Inline-style-ready object: spread straight onto a card's `style={…}`. */
export type CardSwatches = Record<CardSwatchVar, string>;

/**
 * The curated subset of engine tokens we expose as card swatches, mapped to their
 * `--c-*` names. `satisfies` ties each entry to a real `BrandTokenName`, so a token
 * rename in the engine is a compile error here rather than a silent miss.
 */
const STOPS = {
  "--c-surface": "surface",
  "--c-border": "border",
  "--c-text": "text",
  "--c-accent": "accent",
} satisfies Record<CardSwatchVar, BrandTokenName>;

/** `light-dark(<light literal>, <dark literal>)` for one token pair [D5] — as in css.ts. */
function lightDark(pair: SchemePair): string {
  return `light-dark(${formatOklch(pair.light)}, ${formatOklch(pair.dark)})`;
}

/**
 * Derive a small set of inline `--c-*` swatches from a project's `brandColor`.
 * Defensive and total [D9]: any bad/missing/hostile input flows through the engine's
 * fallback palette and still yields a valid swatch object; never throws.
 *
 * @param brandColor Untrusted input (Sanity field, etc.) — `unknown` by design [D9].
 * @param opts       Engine options (e.g. `{ gamut: "p3" }`); defaults to safe sRGB.
 * @returns A `Record<\`--c-${string}\`, string>` of baked `light-dark()` literals.
 */
export function cardSwatches(
  brandColor: unknown,
  opts: EngineOptions = {},
): CardSwatches {
  const set = buildTokenSet(brandColor, opts);
  const swatches = {} as CardSwatches;
  for (const cssVar of Object.keys(STOPS) as CardSwatchVar[]) {
    swatches[cssVar] = lightDark(set.tokens[STOPS[cssVar]]);
  }
  return swatches;
}
