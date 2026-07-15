import type {ValidationContext} from 'sanity'

/**
 * The author-time validator for an `entry`'s theming seeds, extracted from `entry.ts` so it
 * can be unit-tested directly. A PURE function of `(value, context.document)` with no
 * Sanity runtime dependency (the `ValidationContext` import is type-only and erased at build), so
 * a test needs no Studio runtime — it just calls it with a synthetic `{document}` context. It
 * reads `context.document.kind` (always the ROOT document), so it attaches unchanged to the nested
 * `theme.color` / `theme.colorDark` sub-fields. See `entry.ts` for how it attaches.
 *
 * One shape of rule: a PROHIBITION (`forbiddenForNow`) governing only the entry's COLOR.
 * Everything else is capability-gated: the route themes / mounts on the PRESENCE of a field, so
 * `theme.color` (absent → the site default theme), the three font faces, and `componentKey` are
 * plain optional fields the app honors when set (a `note`/`essay`/`demo` that sets
 * `componentKey` mounts its module) and ignores when absent — no validation. The one hard exception
 * is a `now` entry's COLOR: it inherits the single `/now` seed and may not set
 * `theme.color`/`theme.colorDark` at all (`forbiddenForNow` rejects it). See docs/architecture.md
 * → Content model.
 */

/**
 * A `now` entry may NOT carry its own color. A now update inherits the single `/now` page seed
 * (`siteSettings.pageThemes.now`), which themes the `/now` index and every `now` entry alike — so a
 * now entry has no color of its own to set. This REJECTS a non-empty `theme.color` / `theme.colorDark`
 * on a `now` (empty/absent is fine); the whole `theme` object is also hidden for a `now` in the Studio, so this is
 * the belt to that suspenders — an author-time publish guard for anything the hidden field can't
 * prevent. It does NOT cover a raw Content Lake API/import write (schema validation runs in the
 * Studio, not on the write path); the theming guarantee doesn't rely on it — the kind-gated
 * `themeSeed` query ignores a `now`'s own color unconditionally.
 */
export function forbiddenForNow(value: unknown, context: ValidationContext): true | string {
  const kind = (context.document as {kind?: unknown} | undefined)?.kind
  return kind === 'now' && value
    ? 'A “now” entry inherits the /now page seed and can’t set its own color.'
    : true
}
