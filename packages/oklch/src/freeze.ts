/**
 * Recursively `Object.freeze` a value and every object it transitively owns, returning it at
 * its original type.
 *
 * The engine's exported #150 contract — `CONTRAST_TARGETS` (targets.ts) and
 * `DEFAULT_BINDING_SCHEMA` (palette.ts) — must be READ-ONLY at RUNTIME, not just at compile
 * time: `Readonly<…>` and `as const` erase when the TypeScript is transpiled, leaving plain
 * writable singletons every importer of `@garden/oklch` holds a live reference to. The solver
 * reads those exact objects by identity (`resolveTheme` resolves the schema directly; every
 * `auto` binding references a `CONTRAST_TARGETS` tier), so a single stray write anywhere in
 * the process would silently corrupt every subsequent solve (QA-#150). Deep-freezing enforces
 * the contract where it actually has to hold — at runtime.
 *
 * The `isFrozen` guard makes it idempotent and cycle-safe (a shared/already-frozen child is
 * skipped). Isomorphic, pure, no deps, never throws.
 */
export function deepFreeze<T>(value: T): T {
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    !Object.isFrozen(value)
  ) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}
