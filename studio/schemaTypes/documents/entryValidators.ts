import type {ValidationContext} from 'sanity'

/**
 * The conditional-required validators for an `entry`'s theming seeds, extracted from
 * `entry.ts` so they can be unit-tested directly. Both are PURE functions of
 * `(value, context.document)` with no Sanity runtime dependency (the `ValidationContext`
 * import is type-only and erased at build), so a test needs no Studio runtime — it just
 * calls them with a synthetic `{document}` context. See `entry.ts` for how they attach to
 * the `brandColor` / `fontKey` / `componentKey` fields.
 *
 * These enforce only the REQUIRED floor, which is `project`-shaped and unchanged. They are
 * NOT a capability gate: the fields they guard are honored downstream for ANY kind except
 * `now`. The route themes / mounts a module on the presence of the capability field, not on
 * `kind === 'project'` — so a `note` or `essay` that OPTS IN by setting `brandColor` gets a
 * brand scope, and one that sets `componentKey` mounts its module. "Optional" here means
 * "not required", never "ignored". The one exception is `now`: chrome + prose by design, its
 * theming fields are ignored downstream. See docs/architecture.md → Content model.
 */

/**
 * `brandColor` is required for a `project`, any stage — the card plate consumes it even for a
 * sketch, so every project must carry it. Optional for `note` / `essay` (honored when set —
 * it themes the entry's slot) and for `now` (set-but-ignored). Only the project floor is
 * enforced here; presence, not kind, drives theming downstream.
 */
export function requiredForProject(value: unknown, context: ValidationContext): true | string {
  const kind = (context.document as {kind?: unknown} | undefined)?.kind
  return kind === 'project' && !value ? 'Required for a project.' : true
}

/**
 * `componentKey` / `fontKey` are required only for a `project` PAST the sketch stage: they
 * name a coded module + face, and a `stage: sketch` project has no module yet, so it carries
 * a `brandColor` but no componentKey/fontKey until it graduates to prototype/shipped.
 * Optional for every other kind — but honored when set: a `note` / `essay` that names a
 * `componentKey` mounts that module, and its `fontKey` themes the slot. `now` ignores both.
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
