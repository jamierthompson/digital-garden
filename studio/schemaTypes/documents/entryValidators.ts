import type {ValidationContext} from 'sanity'

/**
 * The author-time validators for an `entry`'s theming seeds, extracted from `entry.ts` so they
 * can be unit-tested directly. All are PURE functions of `(value, context.document)` with no
 * Sanity runtime dependency (the `ValidationContext` import is type-only and erased at build), so
 * a test needs no Studio runtime — it just calls them with a synthetic `{document}` context. They
 * read `context.document.kind`/`.stage` (always the ROOT document), so they attach unchanged to the
 * nested `theme.color` / `theme.colorDark` / `theme.bodyFont` sub-fields and the top-level
 * `componentKey`. See `entry.ts` for how they attach.
 *
 * Two shapes of rule: a REQUIRED floor (`requiredForThemedKind`, `requiredForNonSketchProject`)
 * and a PROHIBITION (`forbiddenForNow`). Theming/mounting is otherwise capability-gated — the
 * route themes / mounts on the PRESENCE of a field, so a `note`/`essay` that sets `componentKey`
 * mounts its module even though the key is not *required* of it. The one hard exception is a `now`
 * entry's COLOR: it inherits the single `/now` seed and may not set `theme.color`/`theme.colorDark`
 * at all (`forbiddenForNow` rejects it); its other theming fields (`theme.bodyFont`/`componentKey`)
 * remain accept-but-ignore. See docs/architecture.md → Content model.
 */

/**
 * The themed kinds — every page-shaped entry that derives a theme from its own `theme.color`
 * (#166). Mirror of `entry.ts`'s `KINDS` minus `now` (the one chrome+prose kind, which inherits
 * the `/now` page seed instead). A NEW themed kind opts into the required `theme.color` floor by
 * joining this list; an as-yet-uninvented kind is not silently forced to carry one.
 */
const THEMED_KINDS = ['note', 'essay', 'project'] as const

/**
 * `theme.color` is required for every THEMED kind — note, essay, and project (any stage: the
 * project card plate consumes it even for a sketch, and a note/essay page now themes from it
 * too). Exempt for `now` (chrome + prose — it inherits the `/now` seed) and for a half-created
 * draft whose `kind` isn't picked yet (don't error before the editor chooses). This is only the
 * author-time required floor; the complementary `forbiddenForNow` bans a color on a `now`.
 */
export function requiredForThemedKind(value: unknown, context: ValidationContext): true | string {
  const kind = (context.document as {kind?: unknown} | undefined)?.kind
  const isThemed = (THEMED_KINDS as readonly unknown[]).includes(kind)
  return isThemed && !value
    ? 'Required — every note, essay, and project needs a theme color.'
    : true
}

/**
 * A `now` entry may NOT carry its own color. A now update inherits the single `/now` page seed
 * (`siteSettings.pageThemes.now`), which themes the `/now` index and every `now` entry alike — so a
 * now entry has no color of its own to set. This REJECTS a non-empty `theme.color` / `theme.colorDark`
 * on a `now` (empty/absent is fine); the whole `theme` object is also hidden for a `now` in the Studio, so this is
 * the belt to that suspenders — an author-time publish guard for anything the hidden field can't
 * prevent. It does NOT cover a raw Content Lake API/import write (schema validation runs in the
 * Studio, not on the write path); the theming guarantee doesn't rely on it — the kind-gated
 * `themeSeed` query ignores a `now`'s own color unconditionally. The complementary
 * `requiredForThemedKind` floor never touches `now`.
 */
export function forbiddenForNow(value: unknown, context: ValidationContext): true | string {
  const kind = (context.document as {kind?: unknown} | undefined)?.kind
  return kind === 'now' && value
    ? 'A “now” entry inherits the /now page seed and can’t set its own color.'
    : true
}

/**
 * `componentKey` / `theme.bodyFont` are required only for a `project` PAST the sketch stage: they
 * name a coded module + face, and a `stage: sketch` project has no module yet, so it carries
 * a `theme.color` but no componentKey/bodyFont until it graduates to prototype/shipped.
 * Optional for every other kind — but honored when set: a `note` / `essay` that names a
 * `componentKey` mounts that module, and its `theme.bodyFont` themes the slot. `now` ignores both.
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
