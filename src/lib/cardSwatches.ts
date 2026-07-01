/**
 * `cardSwatches(brandColor)` — engine Consumer C.
 *
 * Derives the `/work` index card's decorative accent as a plain inline style —
 * `{ borderTopColor: "light-dark(<light oklch()>, <dark oklch()>)" }` — that spreads
 * straight onto a card's `style={…}`. **No custom property, no project scope, no `<style>`
 * tag, no class**: the card reads its own inline color, so a dozen differently-accented
 * cards coexist on one grid with zero runtime color math in the browser. A CONSUMER of the
 * OKLCH engine, not part of it, so it lives in `src/lib/` rather than the `@garden/oklch`
 * package.
 *
 * Total and defensive: delegates to `buildTokenSet`, which on bad/missing/hostile input
 * returns the safe fallback palette — so this NEVER throws and always returns a valid style.
 * The value is a BAKED `light-dark()` literal (as in the engine's `css.ts`), so the card
 * reads correctly in both schemes (following the `color-scheme: light dark` on the semantic
 * `:root`).
 *
 * DECORATIVE ONLY. Under the editorial-chrome inversion (#58) a card's surface, border, and
 * text are EDITORIAL (the global semantic tokens) — guaranteed-accessible on the shared grid.
 * The brand color survives only as this single decorative accent bar (non-text, no contrast
 * obligation), so differently-branded cards still read apart without staking card text on a
 * color solved against a brand surface it no longer sits on. It is emitted as a real CSS
 * property, never a project-prefixed custom-property token (#57).
 */

import {
  buildTokenSet,
  formatOklch,
  type EngineOptions,
  type SchemePair,
} from "@garden/oklch";

/** Inline-style-ready object: spread straight onto a card's `style={…}`. */
export type CardSwatches = { borderTopColor: string };

/** `light-dark(<light literal>, <dark literal>)` for one token pair — as in css.ts. */
function lightDark(pair: SchemePair): string {
  return `light-dark(${formatOklch(pair.light)}, ${formatOklch(pair.dark)})`;
}

/**
 * Derive the card's decorative accent color from a project's `brandColor`, as a baked
 * `light-dark()` `borderTopColor`. Defensive and total: any bad/missing/hostile input flows
 * through the engine's fallback palette and still yields a valid style; never throws.
 *
 * @param brandColor Untrusted input (Sanity field, etc.) — `unknown` by design.
 * @param opts       Engine options (e.g. `{ gamut: "p3" }`); defaults to safe sRGB.
 */
export function cardSwatches(
  brandColor: unknown,
  opts: EngineOptions = {},
): CardSwatches {
  const set = buildTokenSet(brandColor, opts);
  return { borderTopColor: lightDark(set.tokens.accent) };
}
