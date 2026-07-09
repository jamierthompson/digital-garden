// Typed accessors for the layout token scales — `space(6)` names a scale step without
// hand-writing `"var(--space-6)"` or picking an off-scale number. The scale VALUES live in
// `src/styles/foundation/space.css`; this module only names the steps. Dependency-free and
// side-effect-free (like `src/lib/keys.ts`) so it imports without pulling in app code.

/** The space scale steps that exist in `foundation/space.css` (`--space-1` … `--space-9`, a 4px grid). */
export type SpaceStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * A space-scale step as a CSS token reference: `space(6)` → `"var(--space-6)"`.
 *
 * Constrained to real steps at compile time. A primitive's spacing prop still accepts any CSS
 * length string (so a future engine-derived `clamp()` passes straight through) — this is just the
 * ergonomic, guarded way to reach the fixed scale.
 */
export function space(step: SpaceStep): string {
  return `var(--space-${step})`;
}
