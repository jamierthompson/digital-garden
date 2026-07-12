/**
 * Per-page engine theming — deriving a page's semantic custom properties from its authored seed.
 *
 * The sibling axis to `scheme.ts` (the binary light ⇄ dark choice). Where a scheme is a
 * client-known preference (read from `localStorage`, so it MUST be an inline script that reads
 * storage), a page's theme seed is **author-set and server-known** — every visitor sees the
 * authored intent, there is no play override outside `/color-engine`, and theming carries no
 * `localStorage`. So the server BAKES the resolved values into CSS; first paint is the easy case:
 *
 *   • Hard load / refresh — the page renders the declarations as a `:root { … }` `<style>`
 *     (`ThemeStyle`); React hoists it into `<head>`, ahead of the body chrome, so the theme
 *     is applied before ANY content paints — no script, no parse-order dependency. This is
 *     `EntryCard`'s server-rendered baked-CSS approach lifted to `:root`. The page stays static.
 *   • Soft navigation & `<Activity>` reveal — a Client Component re-applier calls
 *     `applyThemeDeclarations` in a layout effect, re-stamping the declarations imperatively on
 *     `<html>`. This exists SOLELY for soft nav: the persistent chrome doesn't reload, so the CSS
 *     must be re-applied via JS. (A layout effect, NOT an insertion effect: only the former
 *     re-runs on `<Activity>` reveal — see `ThemeReapplier`.)
 *
 * The two layers compose by the cascade: the imperative `<html>.style` write (soft nav) out-ranks
 * the `:root` rule (hard load), which is UNLAYERED so it out-ranks the `@layer base` fallback
 * (the "@layer trap"). So under `<Activity>` (React keeps several routes mounted) the visible
 * route's imperative write always wins — lingering `:root` styles from hidden routes are inert.
 *
 * Isomorphic & framework-agnostic (no `use client`, every DOM access inside a function body):
 * the server page imports `resolveThemeDeclarations` (→ `ThemeStyle`); the client re-applier
 * imports `applyThemeDeclarations`. Mirrors `scheme.ts`'s split.
 */

import {
  buildTokenSet,
  tokenSetToDeclarations,
  type TokenSet,
} from "@garden/oklch";

/**
 * One semantic custom property to stamp on `<html>`, as a `[property, value]` pair —
 * e.g. `["--surface", "light-dark(oklch(…), oklch(…))"]`. A pair (not a CSS string) so the
 * appliers can `setProperty` one token at a time, layering alongside the inline `color-scheme`
 * the scheme toggle writes instead of clobbering it.
 */
export type ThemeDeclaration = [property: string, value: string];

/**
 * Derive a page's semantic custom-property declarations from its authored theme seed. A thin
 * wrapper over the engine: `buildTokenSet` (contrast-solved, gamut-mapped, both schemes zipped
 * into `light-dark()`, never throws) + `tokenSetToDeclarations` (the generic `--surface`…
 * `--success` semantic tier — the same role names `semantic/color.css` binds as the editorial
 * default), parsed into the pairs the imperative appliers stamp. `themeColor` is `unknown`
 * because the seed is authored, untrusted input; the engine collapses anything unparseable to a
 * safe fallback rather than throwing, so this never rejects a bad seed.
 */
export function resolveThemeDeclarations(
  themeColor: unknown,
): ThemeDeclaration[] {
  return tokenSetToThemeDeclarations(buildTokenSet(themeColor));
}

/**
 * Parse an already-built `TokenSet` into the imperative `<html>` declarations — the tail of the
 * same pipeline `resolveThemeDeclarations` runs, split out so a caller that already holds a
 * derived token set stamps the SAME declarations the authored path bakes. `/color-engine`'s
 * ephemeral play path holds a live, rules-/gamut-treated palette (`derivePalette(...).tokenSet`)
 * and drives this directly, so its client re-stamp and the server's baked theme can never drift.
 */
export function tokenSetToThemeDeclarations(
  tokenSet: TokenSet,
): ThemeDeclaration[] {
  return parseDeclarations(tokenSetToDeclarations(tokenSet));
}

/**
 * Parse the engine's `--name: value;` declaration block (one declaration per line) into
 * `[name, value]` pairs. The engine's `light-dark()` values carry no newlines or colons, so
 * splitting on the line boundary and the first `:` is unambiguous.
 */
function parseDeclarations(css: string): ThemeDeclaration[] {
  const declarations: ThemeDeclaration[] = [];
  for (const line of css.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const property = line.slice(0, separator).trim();
    if (!property.startsWith("--")) continue;
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/;$/, "");
    declarations.push([property, value]);
  }
  return declarations;
}

/**
 * Stamp the page's declarations onto `<html>` imperatively — one `setProperty` per token, so it
 * layers alongside (never clobbers) the inline `color-scheme` the scheme toggle writes. The
 * whole architecture rests on this being a single imperative write to one node: it cannot
 * collide with itself across the routes `<Activity>` keeps mounted (unlike a per-route `:root`
 * `<style>` block, #168), so the visible route's re-applier always wins. Mirrors
 * `scheme.ts`'s `applyScheme`.
 */
export function applyThemeDeclarations(declarations: ThemeDeclaration[]): void {
  const { style } = document.documentElement;
  for (const [property, value] of declarations) {
    style.setProperty(property, value);
  }
}
