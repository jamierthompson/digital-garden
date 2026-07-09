import type { ThemeDeclaration } from "@/lib/theme";

/**
 * The flash-free FIRST-PAINT theme: a `:root` rule carrying the page's seed as `light-dark()`
 * literals, rendered as a hoistable `<style>` so React 19 lifts it into the single `<head>` —
 * emitted before the body chrome, so the theme applies before ANY content paints, with no
 * script and no parse-order dependency.
 *
 * This is exactly `EntryCard`'s server-rendered baked-CSS approach (`cardSwatches` spread inline
 * on the `<li>`), lifted to `:root` so the persistent chrome inherits it. First paint is the EASY
 * case — the seed is server-known, so it bakes into the initial HTML as CSS. It is **unlayered**,
 * so it out-ranks the `@layer foundation`/`semantic` fallback `:root` via the "@layer trap" —
 * the same way a card's inline style out-ranks the layered defaults.
 *
 * `ThemeReapplier` (the sibling in `PageTheme`) exists SOLELY for soft navigation: the persistent
 * `SiteNav`/`SiteFooter` don't reload, so their theme must be re-stamped imperatively on `<html>`.
 * Its element-inline write out-ranks this `:root` rule, so under `<Activity>` (React keeps several
 * routes mounted) the visible route always wins and lingering `:root` styles from hidden routes
 * are inert — no per-route `:root` collision.
 *
 * `href` + `precedence` are the props that opt a `<style>` into React's `<head>` hoisting and
 * de-duplication. The value is a baked engine literal (`light-dark(oklch(…))`, no `<`/`>`), but
 * `</style>` breakout is refused defensively at this boundary — the `/color-engine` play path
 * feeds the same primitive, so a hostile seed must never be able to close the element.
 */
export default function ThemeStyle({
  declarations,
}: {
  declarations: ThemeDeclaration[];
}): React.JSX.Element {
  const css = `:root{${declarations
    .map(([property, value]) => `${cssSafe(property)}:${cssSafe(value)}`)
    .join(";")}}`;
  return (
    <style
      href="page-theme"
      precedence="high"
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}

/**
 * A CSS declaration can't legitimately contain `<`/`>` (engine output is `light-dark(oklch(…))`),
 * so escape them as CSS code points — behavior-preserving on real values, but no seed can forge
 * `</style>` and close the element (the injection boundary for the `/color-engine` play path,
 * which feeds this same primitive live-recomputed declarations).
 */
function cssSafe(text: string): string {
  return text.replace(
    /[<>]/g,
    (char) => `\\${char.charCodeAt(0).toString(16)} `,
  );
}
