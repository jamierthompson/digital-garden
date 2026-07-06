import type {ValidationContext} from 'sanity'

/**
 * The conditional-required validators for an `entry`'s theming seeds, extracted from
 * `entry.ts` so they can be unit-tested directly. Both are PURE functions of
 * `(value, context.document)` with no Sanity runtime dependency (the `ValidationContext`
 * import is type-only and erased at build), so a test needs no Studio runtime — it just
 * calls them with a synthetic `{document}` context. See `entry.ts` for how they attach to
 * the `brandColor` / `fontKey` / `componentKey` fields.
 *
 * These enforce only the REQUIRED floor. They are NOT a capability gate: the fields they guard
 * are honored downstream for ANY kind except `now`. The route themes / mounts a module on the
 * presence of the capability field — so a `note` or `essay` that sets `componentKey` mounts its
 * module even though the key is not *required* of it. The one exception is `now`: chrome + prose
 * by design, its theming fields are ignored downstream. See docs/architecture.md → Content model.
 */

/**
 * The themed kinds — every page-shaped entry that derives a theme from its own `brandColor`
 * (#166). Mirror of `entry.ts`'s `KINDS` minus `now` (the one chrome+prose kind, which inherits
 * the `/now` page seed instead). A NEW themed kind opts into the required `brandColor` floor by
 * joining this list; an as-yet-uninvented kind is not silently forced to carry one.
 */
const THEMED_KINDS = ['note', 'essay', 'project'] as const

/**
 * `brandColor` is required for every THEMED kind — note, essay, and project (any stage: the
 * project card plate consumes it even for a sketch, and a note/essay page now themes from it
 * too). Exempt for `now` (chrome + prose — it inherits the `/now` seed) and for a half-created
 * draft whose `kind` isn't picked yet (don't error before the editor chooses). Presence, not
 * kind, still drives theming downstream; this is only the author-time floor.
 */
export function requiredForThemedKind(value: unknown, context: ValidationContext): true | string {
  const kind = (context.document as {kind?: unknown} | undefined)?.kind
  const isThemed = (THEMED_KINDS as readonly unknown[]).includes(kind)
  return isThemed && !value
    ? 'Required — every note, essay, and project needs a brand color.'
    : true
}

/**
 * A `now` entry may NOT carry its own color. A now update inherits the single `/now` page seed
 * (`siteSettings.pageThemes.now`), which themes the `/now` index and every `now` entry alike — so a
 * now entry has no color of its own to set. This REJECTS a non-empty `brandColor` / `brandColorDark`
 * on a `now` (empty/absent is fine); the field is also hidden for a `now` in the Studio, so this is
 * the belt to that suspenders — it guards the API/import path a hidden field can't. The
 * complementary `requiredForThemedKind` floor never touches `now`.
 */
export function forbiddenForNow(value: unknown, context: ValidationContext): true | string {
  const kind = (context.document as {kind?: unknown} | undefined)?.kind
  return kind === 'now' && value
    ? 'A “now” entry inherits the /now page seed and can’t set its own color.'
    : true
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
