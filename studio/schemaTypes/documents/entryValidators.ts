import type {ValidationContext} from 'sanity'

/**
 * The author-time validators for an `entry`'s theming seeds, extracted from `entry.ts` so they
 * can be unit-tested directly. All are PURE functions of `(value, context.document)` with no
 * Sanity runtime dependency (the `ValidationContext` import is type-only and erased at build), so
 * a test needs no Studio runtime — it just calls them with a synthetic `{document}` context. They
 * read `context.document.kind` (always the ROOT document), so they attach unchanged to the nested
 * `theme.color` / `theme.colorDark` sub-fields. See `entry.ts` for how they attach.
 *
 * Two shapes of rule: a REQUIRED floor (`requiredForThemedKind`) and a PROHIBITION
 * (`forbiddenForNow`), both governing only the entry's COLOR. Everything else is capability-gated:
 * the route themes / mounts on the PRESENCE of a field, so the three font faces and `componentKey`
 * are plain optional fields the app honors when set (a `note`/`essay`/`project` that sets
 * `componentKey` mounts its module) and ignores when absent — no validation. The one hard exception
 * is a `now` entry's COLOR: it inherits the single `/now` seed and may not set
 * `theme.color`/`theme.colorDark` at all (`forbiddenForNow` rejects it). See docs/architecture.md
 * → Content model.
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
