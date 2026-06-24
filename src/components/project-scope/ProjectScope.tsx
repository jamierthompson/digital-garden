import type { ReactNode } from "react";

import { resolveScope, scopedStyleCss } from "./scopeSeed";

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
 *    literals `[D3, D5]`, the `--focus-ring-color` alias `[D7]`, and the resolved font's
 *    `--font-face` mapping — all in one block declared `@layer brand` `[D12]`.
 * 2. Wraps its subtree in `[data-project="<slug>"]`, mounting the resolved roster face's
 *    `.variable` className so `var(--font-face)` has its variable in scope `[D11]`.
 *    Everything beneath reads `var(--brand-*)` / `var(--font-face)`.
 *
 * Flash-free mechanics `[D13]`: the `<style>` uses React 19's `precedence` + a slug
 * `href`. React hoists it into `<head>`, de-dupes by `href`, and orders by precedence —
 * so even when the route streams (a suspended hole below), the theme is in the initial
 * shell HTML **before** the body paints (no FOUC). The `precedence` string and the
 * `@layer brand` wrapper produced by `scopedStyleCss` are two halves of one mechanism and
 * MUST stay the literal string `brand` together — see `scopeSeed.ts` `[D13]`.
 *
 * Defensive by construction `[D9]`: `resolveScope` never throws and collapses any bad
 * seed to a safe fallback palette + shell font, so this component cannot throw on bad
 * input. It is ALSO wrapped at the route in `unstable_catchError` (see
 * `ProjectScopeBoundary`) as the last-resort backstop — `error.tsx` can't catch a
 * layout-level throw, so a component boundary is the correct containment `[D9]`.
 *
 * Kept synchronous on purpose: it awaits nothing and does no I/O, so it prerenders into
 * the static shell automatically (flash-free) — Next 16's Cache Components includes the
 * output of synchronous components in the static HTML shell with no `use cache` needed
 * (`node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`). Staying
 * synchronous ALSO keeps it unit-testable in jsdom (async RSCs do not render there).
 */
export default function ProjectScope({ seed, children }: ProjectScopeProps) {
  const scope = resolveScope(seed);
  return (
    <>
      <style href={`project-theme-${scope.slug}`} precedence="brand">
        {scopedStyleCss(scope)}
      </style>
      {/* The resolved face's `.variable` className brings `var(--font-face)`'s variable
          into scope. The shell-mono fallback has no roster class (its variable is already
          on `<html>`), so `className` is omitted to avoid an empty class attribute. */}
      <div
        data-project={scope.slug}
        className={scope.font.variable || undefined}
      >
        {children}
      </div>
    </>
  );
}
