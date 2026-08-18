/**
 * Zero-width characters that carry no visible glyph but ARE truthy, and which
 * `String.prototype.trim` does NOT remove (of the four, only U+FEFF is JS whitespace).
 *
 * `@sanity/client`'s stega encoder builds its Content Source Map payload from exactly these
 * (`@vercel/stega`'s alphabet: 8203 / 8204 / 8205 / 65279) and applies no minimum-length guard,
 * so an authored `""` can come back as a string of invisible characters — truthy, untrimmable,
 * and indistinguishable from real copy to a falsy check. Stripping them before the emptiness test
 * is what keeps the guard honest in Draft Mode, where Presentation renders drafts with stega on
 * (`src/sanity/lib/live.ts`).
 */
const ZERO_WIDTH = /[​‌‍﻿]/gu;

/**
 * The visible text of an authored string, or `null` when there is none to show.
 *
 * The guard every entry surface uses to decide whether a nullable Studio field holds anything a
 * reader would actually see. Absent, empty, whitespace-only, and zero-width-only all collapse to
 * `null`, so a caller branches on one truthy check — and a blank field can never reach a heading,
 * a link's accessible name, or a paragraph as invisible content.
 *
 * Presence is NOT guaranteed upstream, which is why this exists rather than a bare `||`:
 * `required()` in the Studio is a falsy check with no trim (a whitespace-only string publishes
 * clean), `summary` carries no presence rule at all, and validation never gates DRAFTS — which
 * this app renders whenever Draft Mode is on. Same never-throws posture as `EntryMeta`'s `asText`
 * and the theming chain: ragged content degrades, it never renders as an empty element.
 *
 * Returns the ORIGINAL string when it has visible text, never the trimmed one — trimming is the
 * presence TEST here, not a transform, so authored prose passes through byte-for-byte and keeps
 * the stega payload Visual Editing's click-to-edit overlay resolves against. Use `linkableSlug`
 * for values that become a URL.
 */
export function visibleText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return value.replace(ZERO_WIDTH, "").trim() ? value : null;
}

/**
 * A slug safe to build a link from, or `null` when there is none — the href counterpart to
 * `visibleText`.
 *
 * Returns the TRIMMED slug rather than the original: this value is consumed by code (it becomes
 * `/[slug]`), so padding is a defect to strip, not authored copy to preserve. A padded slug would
 * otherwise ship a live `href="/   "` — a dead link pointing at a route that cannot resolve.
 * There is no stega payload to protect here; Sanity's default denylist already excludes
 * `slug.current` from encoding.
 *
 * The Studio's `^[a-z0-9-]+$` rule would reject a padded slug, but that rule runs at PUBLISH
 * validation only and never sees a draft — and Presentation is exactly where an author clicks
 * these links.
 */
export function linkableSlug(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}
