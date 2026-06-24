/**
 * `cardSwatches(brandColor)` — engine Consumer C (§3.2, §6).
 *
 * The `/work` index cards want "a few colors per card" derived from a project's
 * `brandColor`, but WITHOUT a project scope: no island, no `<style>` tag, no class —
 * just a small bag of inline CSS custom properties (`--c-*`) to spread onto a card
 * element's `style={…}`. This is a CONSUMER of the OKLCH engine, not part of it, so it
 * lives in `src/lib/` (an app consumer) rather than inside the `@garden/oklch` engine
 * package itself (§3.2) [D23].
 *
 * It runs on the SAME defensive parse/validate path as everything else: it delegates to
 * the high-level `buildTokenSet`, which parses defensively, gamut-maps, contrast-solves,
 * and — on bad/missing/hostile input — returns the safe fallback palette with
 * `meta.isFallback = true`. So `cardSwatches` is TOTAL: it NEVER throws and always
 * returns a valid swatch object [D9].
 *
 * Values are BAKED literals, composed the same way the engine's `css.ts` composes them:
 * each
 * stop is `light-dark(<light oklch() literal>, <dark oklch() literal>)` so a card reads
 * correctly in both schemes with zero runtime color math in the browser [D3, D5].
 *
 * WHICH STOPS, AND WHY — kept deliberately to "a few", the minimum a self-themed card
 * needs to stand apart on the shared `/work` grid:
 *   • `--c-surface` — the card's own tinted background fill (brand-tinted near-neutral).
 *   • `--c-border`  — its edge / divider against the page (contrast-solved hairline).
 *   • `--c-text`    — body/label text that clears AA on that surface.
 *   • `--c-accent`  — the brand pop (chip, rule, hover) — the card's identity at a glance.
 * These map 1:1 onto engine tokens, so the colors are exactly the contrast-solved ones
 * the full project scope would use — just a curated subset, inline, with no scope.
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
 *
 * Pure and isomorphic-friendly: it only calls the engine and returns a plain object —
 * no `next/*`, no React, no DOM/Node globals. Defensive and total [D9]: any bad, missing,
 * or hostile `brandColor` flows through the engine's fallback palette and still yields a
 * valid swatch object; this function never throws.
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
