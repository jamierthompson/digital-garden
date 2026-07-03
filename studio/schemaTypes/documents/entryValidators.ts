import type {ValidationContext} from 'sanity'

/**
 * The conditional-required validators for an `entry`'s theming seeds, extracted from
 * `entry.ts` so they can be unit-tested directly. Both are PURE functions of
 * `(value, context.document)` with no Sanity runtime dependency (the `ValidationContext`
 * import is type-only and erased at build), so a test needs no Studio runtime — it just
 * calls them with a synthetic `{document}` context. See `entry.ts` for how they attach to
 * the `brandColor` / `fontKey` / `componentKey` fields.
 */

/**
 * Required for a `project`, any stage. Used by `brandColor` — the card plate consumes it
 * even for a sketch, so every project needs it.
 */
export function requiredForProject(value: unknown, context: ValidationContext): true | string {
  const kind = (context.document as {kind?: unknown} | undefined)?.kind
  return kind === 'project' && !value ? 'Required for a project.' : true
}

/**
 * Required only for a `project` PAST the sketch stage. Used by `componentKey` / `fontKey`,
 * which name a coded module + face: a `stage: sketch` project has no module yet, so it
 * carries a `brandColor` but no componentKey/fontKey until it graduates to prototype/shipped.
 */
export function requiredForNonSketchProject(
  value: unknown,
  context: ValidationContext,
): true | string {
  const doc = context.document as {kind?: unknown; stage?: unknown} | undefined
  return doc?.kind === 'project' && doc?.stage !== 'sketch' && !value
    ? 'Required for a project past the sketch stage.'
    : true
}
