/**
 * Per-page engine theming — deriving a page's semantic custom properties from its authored
 * seed and stamping them imperatively on `<html>`, flash-free.
 *
 * The sibling axis to `scheme.ts` (the binary light ⇄ dark choice). Where a scheme is a
 * client-known preference (read from `localStorage`, so it MUST be an inline script that reads
 * storage), a page's theme seed is **author-set and server-known** — every visitor sees the
 * authored intent, there is no play override outside `/color-engine`, and theming carries no
 * `localStorage`. So the server BAKES the resolved values in:
 *
 *   • Hard load / refresh — the page renders `themeInitScript(declarations)`, an inline
 *     `<script>` with the seed's values baked in, run during HTML parse (before first paint)
 *     to stamp `<html>`. The page stays static (no `cookies()`).
 *   • Soft navigation & `<Activity>` reveal — a Client Component re-applier calls
 *     `applyThemeDeclarations` in a layout effect, re-stamping the page's declarations
 *     (received as a prop) to `<html>`. Inline scripts don't re-run on soft nav; this does.
 *     (A layout effect, NOT an insertion effect: only the former re-runs on `<Activity>`
 *     reveal — proven by the slice-1 spike; see `ThemeReapplier`.)
 *
 * The theme is a single imperative write to `<html>` — never a per-route `:root` `<style>`
 * block, which collides across the routes `<Activity>` keeps mounted at once (#168). Chrome and
 * page both inherit from `<html>`, so the persistent chrome re-matches the visible page with no
 * re-render (CSS custom-property inheritance is live).
 *
 * Isomorphic & framework-agnostic (no `use client`, every DOM access inside a function body):
 * the server page imports `resolveThemeDeclarations` + `themeInitScript`; the client re-applier
 * imports `applyThemeDeclarations`. Mirrors `scheme.ts`'s split exactly.
 */

import { buildTokenSet, tokenSetToDeclarations } from "@garden/oklch";

/**
 * One semantic custom property to stamp on `<html>`, as a `[property, value]` pair —
 * e.g. `["--surface", "light-dark(oklch(…), oklch(…))"]`. A pair (not a CSS string) so the
 * appliers can `setProperty` one token at a time, layering alongside the inline `color-scheme`
 * the scheme toggle writes instead of clobbering it.
 */
export type ThemeDeclaration = [property: string, value: string];

/**
 * Derive a page's semantic custom-property declarations from its authored brand seed. A thin
 * wrapper over the engine: `buildTokenSet` (contrast-solved, gamut-mapped, both schemes zipped
 * into `light-dark()`, never throws) + `tokenSetToDeclarations` (the generic `--surface`…
 * `--success` semantic tier — the same role names `foundation.css` binds as the editorial
 * default), parsed into the pairs the imperative appliers stamp. `brandColor` is `unknown`
 * because the seed is authored, untrusted input; the engine collapses anything unparseable to a
 * safe fallback rather than throwing, so this never rejects a bad seed.
 */
export function resolveThemeDeclarations(
  brandColor: unknown,
): ThemeDeclaration[] {
  const css = tokenSetToDeclarations(buildTokenSet(brandColor));
  return parseDeclarations(css);
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

/**
 * The flash-free hard-load script: a self-contained inline `<script>` body with the page's
 * resolved declarations BAKED IN, run during HTML parse (before first paint) to stamp `<html>`.
 * Unlike `scheme.ts`'s static `SCHEME_INIT_SCRIPT`, the seed is server-known, so this is a
 * function producing a per-page baked string with no `localStorage` read. The page renders the
 * returned string via `dangerouslySetInnerHTML` (see `PageTheme`). Self-guarding and standalone
 * — it runs before any bundle. Values are engine-emitted `light-dark(oklch(…))` literals (no
 * `<` / `</script>`), so the `JSON.stringify` embedding is injection-safe.
 */
export function themeInitScript(declarations: ThemeDeclaration[]): string {
  return `(function(){var s=document.documentElement.style;var d=${JSON.stringify(
    declarations,
  )};for(var i=0;i<d.length;i++){s.setProperty(d[i][0],d[i][1])}})();`;
}
