// Typed accessors for the layout token scales — the safe way to reach a raw scale step from a
// component prop under the "conduit" primitive pattern. A layout primitive takes its token as a
// prop and passes it straight through to an inline CSS custom property (so container queries and
// a future derivation engine can drive the value without touching call sites); `space(6)` is how
// a caller names a step without hand-writing `"var(--space-6)"` and without being able to pick an
// off-scale number. The scale VALUES live in `src/styles/foundation.css` (@layer foundation) —
// this module only names the steps.
//
// Kept dependency-free and side-effect-free, mirroring `src/lib/keys.ts`: a token contract the
// app (and, if ever needed, the standalone Studio) can import without pulling in app code.

/** The space scale steps that exist in `foundation.css` (`--space-1` … `--space-9`, a 4px grid). */
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
