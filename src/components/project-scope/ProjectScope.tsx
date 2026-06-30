import type { ReactNode } from "react";

import { BRAND_LAYER, resolveScope, scopedStyleCss } from "./scopeSeed";

interface ProjectScopeProps {
  /** Untrusted scope seed (e.g. `{ slug }` from route params). Resolved defensively. */
  seed: unknown;
  children: ReactNode;
}

/**
 * The keystone. A **synchronous** server component that turns a scope seed into a
 * flash-free scoped theme:
 *
 * 1. Emits the scoped `<style>`: the OKLCH engine's baked `--brand-*` `light-dark()`
 *    literals, the `--focus-ring-color` alias, and the resolved font's
 *    `--font-face` mapping — all in one block declared `@layer brand`.
 * 2. Wraps its subtree in `[data-project="<slug>"]`, mounting the resolved roster face's
 *    `.variable` className so `var(--font-face)` has its variable in scope.
 *
 * Flash-free mechanics: the `<style>` uses React 19's `precedence` + a slug `href`.
 * React hoists it into `<head>`, de-dupes by `href`, and orders by precedence — so even when
 * the route streams, the theme is in the initial shell HTML **before** the body paints (no
 * FOUC). The `precedence` and the `@layer` wrapper from `scopedStyleCss` both read the single
 * `BRAND_LAYER` const so they cannot desync — see `scopeSeed.ts`.
 *
 * Defensive by construction: `resolveScope` never throws — it collapses any bad seed
 * to a safe fallback palette + shell font. It is ALSO wrapped at the route in
 * `unstable_catchError` (see `ProjectScopeBoundary`) as the last-resort backstop: `error.tsx`
 * can't catch a layout-level throw, so a component boundary is the correct containment.
 *
 * Synchronous on purpose: it awaits nothing, so it prerenders into the static shell with no
 * `use cache` needed (`node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`),
 * and stays unit-testable in jsdom (async RSCs do not render there).
 */
export default function ProjectScope({ seed, children }: ProjectScopeProps) {
  const scope = resolveScope(seed);
  return (
    <>
      {/* `precedence` and the `@layer` in `scopedStyleCss` read the SAME `BRAND_LAYER`
          const, so hoist order and cascade layer cannot desync. */}
      <style href={`project-theme-${scope.slug}`} precedence={BRAND_LAYER}>
        {scopedStyleCss(scope)}
      </style>
      {/* Shell-mono fallback has no roster class (its variable is already on `<html>`), so
          `className` is omitted to avoid an empty class attribute. */}
      <div
        data-project={scope.slug}
        className={scope.font.variable || undefined}
      >
        {children}
      </div>
    </>
  );
}
