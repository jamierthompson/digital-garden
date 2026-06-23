import type { ReactNode } from "react";

import { resolveScope, scopedStyleCss } from "./scopeSeed";

interface ProjectScopeProps {
  /** Untrusted scope seed (e.g. `{ slug }` from route params). Resolved defensively. */
  seed: unknown;
  children: ReactNode;
}

/**
 * The Phase 0.5 STUB keystone. A **synchronous** server component that turns a scope
 * seed into a flash-free scoped theme:
 *
 * 1. Emits the scoped `<style>` (engine palette → `--brand-*`, font → `--font-face`),
 *    declared `@layer brand` `[D12]`.
 * 2. Wraps its subtree in `[data-project="<slug>"]`, under which everything reads
 *    `var(--brand-*)` / `var(--font-face)`.
 *
 * Flash-free mechanics `[D13]`: the `<style>` uses React 19's `precedence` + a slug
 * `href`. React hoists it into `<head>`, de-dupes by `href`, and orders by precedence —
 * so even when the route streams (a suspended hole below), the theme is in the initial
 * shell HTML **before** the body paints (no FOUC). Per `[D13]` plain inline `<style>` is
 * enough when the scope is never suspended; the skeleton deliberately uses the
 * `precedence` form to retire the React-19-version-dependent hoisting unknown on the real
 * stack.
 *
 * Defensive by construction `[D9]`: `resolveScope` never throws and collapses any bad
 * seed to a safe fallback palette, so this component cannot throw on bad input. It is
 * ALSO wrapped at the route in `unstable_catchError` (see `ProjectScopeBoundary`) as the
 * last-resort backstop — `error.tsx` can't catch a layout-level throw, so a component
 * boundary is the correct containment `[D9]`.
 *
 * Kept synchronous on purpose: it awaits nothing, so it prerenders into the static shell
 * (flash-free), AND it stays unit-testable in jsdom (async RSCs do not render there).
 */
export default function ProjectScope({ seed, children }: ProjectScopeProps) {
  const scope = resolveScope(seed);
  return (
    <>
      <style href={`project-theme-${scope.slug}`} precedence="brand">
        {scopedStyleCss(scope)}
      </style>
      <div data-project={scope.slug}>{children}</div>
    </>
  );
}
