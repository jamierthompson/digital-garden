/**
 * `cardSwatches(brandColor)` — engine Consumer C.
 *
 * Derives a single inline CSS custom property (`--c-accent`) from a project's
 * `brandColor` for the `/work` index cards — no project scope, no `<style>` tag, no
 * class. A CONSUMER of the OKLCH engine, not part of it, so it lives in `src/lib/`
 * rather than inside the `@garden/oklch` package.
 *
 * Total and defensive: delegates to `buildTokenSet`, which on bad/missing/hostile
 * input returns the safe fallback palette — so this NEVER throws and always returns a
 * valid swatch object. The value is a BAKED `light-dark(<light oklch()>, <dark oklch()>)`
 * literal (as in the engine's `css.ts`), so a card reads correctly in both schemes
 * with zero runtime color math in the browser.
 *
 * DECORATIVE ONLY. Under the editorial-chrome inversion (#58) a card's surface, border,
 * and text are EDITORIAL (the global semantic tokens) — guaranteed-accessible on the shared
 * grid. The brand color survives as a single decorative accent (a non-text swatch/bar), so
 * differently-branded cards still read apart without staking card text on a color solved
 * against a brand surface it no longer sits on.
 */

import {
  buildTokenSet,
  formatOklch,
  type BrandTokenName,
  type EngineOptions,
  type SchemePair,
} from "@garden/oklch";

/** The card swatch custom-property name — the `--c-*` inline contract. */
export type CardSwatchVar = "--c-accent";

/** Inline-style-ready object: spread straight onto a card's `style={…}`. */
export type CardSwatches = Record<CardSwatchVar, string>;

/**
 * The engine token we expose as the card's decorative accent, mapped to its `--c-*`
 * name. `satisfies` ties the entry to a real `BrandTokenName`, so a token rename in the
 * engine is a compile error here rather than a silent miss.
 */
const STOPS = {
  "--c-accent": "accent",
} satisfies Record<CardSwatchVar, BrandTokenName>;

/** `light-dark(<light literal>, <dark literal>)` for one token pair — as in css.ts. */
function lightDark(pair: SchemePair): string {
  return `light-dark(${formatOklch(pair.light)}, ${formatOklch(pair.dark)})`;
}

/**
 * Derive a small set of inline `--c-*` swatches from a project's `brandColor`.
 * Defensive and total: any bad/missing/hostile input flows through the engine's
 * fallback palette and still yields a valid swatch object; never throws.
 *
 * @param brandColor Untrusted input (Sanity field, etc.) — `unknown` by design.
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
