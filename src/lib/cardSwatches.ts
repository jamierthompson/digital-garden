/**
 * `cardSwatches(brandColor)` — engine Consumer C.
 *
 * Derives a project card's full engine-solved palette from its `brandColor`, as inline
 * overrides of the GENERIC semantic tokens (`--surface`, `--text`, `--border`, `--accent`) —
 * the same role names every component already reads. Spread straight onto a card's `style={…}`
 * they re-bind those tokens for that card's subtree (scope-isolation via the inline cascade),
 * so a dozen differently-branded cards coexist on one grid with no `<style>` tag, no class,
 * and no project-prefixed token names (#57). A CONSUMER of the OKLCH engine, not part of it,
 * so it lives in `src/lib/` rather than inside the `@garden/oklch` package.
 *
 * Why the FULL palette, not a lone accent: the `/work` grid is the engine's live contrast
 * stress-test. A card's SURFACE and TEXT are BOTH engine-derived, so the ratio between them
 * *is* the solver's output — exercised and visible at every brand value across the grid. A
 * card is a project's own scoped slot (not chrome), so a fully-branded card is exactly "brand
 * scoped to the slot"; the editorial-chrome inversion (#58) governs the shell and page frame,
 * not the project slots.
 *
 * Total and defensive: delegates to `buildTokenSet`, which on bad/missing/hostile input
 * returns the safe fallback palette — so this NEVER throws and always returns a valid swatch
 * object. Values are BAKED `light-dark(<light oklch()>, <dark oklch()>)` literals (as in the
 * engine's `css.ts`), so a card reads correctly in both schemes with zero runtime color math.
 */

import {
  buildTokenSet,
  formatOklch,
  type BrandTokenName,
  type EngineOptions,
  type SchemePair,
} from "@garden/oklch";

/** The generic semantic tokens a card re-binds inline — no bespoke prefix (#57). */
export type CardSwatchVar = "--surface" | "--text" | "--border" | "--accent";

/** Inline-style-ready object: spread straight onto a card's `style={…}`. */
export type CardSwatches = Record<CardSwatchVar, string>;

/**
 * The engine tokens a card re-binds, keyed by the generic semantic name they override.
 * `satisfies` ties each entry to a real `BrandTokenName`, so a token rename in the engine is
 * a compile error here rather than a silent miss. `surface`/`text` are the contrast-solved
 * pair the stress-test hinges on; `border` and `accent` are the hairline + brand pop.
 */
const STOPS = {
  "--surface": "surface",
  "--text": "text",
  "--border": "border",
  "--accent": "accent",
} satisfies Record<CardSwatchVar, BrandTokenName>;

/** `light-dark(<light literal>, <dark literal>)` for one token pair — as in css.ts. */
function lightDark(pair: SchemePair): string {
  return `light-dark(${formatOklch(pair.light)}, ${formatOklch(pair.dark)})`;
}

/**
 * Derive a card's inline semantic-token overrides from a project's `brandColor`.
 * Defensive and total: any bad/missing/hostile input flows through the engine's fallback
 * palette and still yields a valid swatch object; never throws.
 *
 * @param brandColor Untrusted input (Sanity field, etc.) — `unknown` by design.
 * @param opts       Engine options (e.g. `{ gamut: "p3" }`); defaults to safe sRGB.
 * @returns A `Record` of generic semantic names → baked `light-dark()` literals.
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
