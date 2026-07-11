import {at, defineMigration, set, unset} from 'sanity/migrate'

/**
 * Fold each themed entry's flat theming fields into the first-class `theme` object (#249).
 *
 * The code and GROQ flipped from flat `themeColor` / `themeColorDark` / `fontKey` to a nested
 * `theme { color, colorDark, bodyFont }` in the same slice, so the `production` dataset must be
 * reshaped in lockstep. Per themed entry (the note/essay/project docs that carry a `themeColor`;
 * the `now` entries carry none and are skipped) this SETs
 *
 *   theme = { color: themeColor, colorDark?: themeColorDark, bodyFont?: fontKey }
 *
 * and UNSETs the three retired keys. Optional keys are omitted when absent — never written as
 * `undefined`. It is idempotent: the GROQ `filter` skips any doc that already has a `theme` or
 * carries no `themeColor`, and the in-code guard re-checks the same so a re-run is a no-op.
 *
 * Run it as the deploy promotes so schema + code + data cut over together (the OKLCH engine never
 * throws, so the only exposure is a brief cosmetic fallback-palette window, never a crash). From
 * `studio/`, dry-run first, then execute:
 *
 *   pnpm sanity migrations run entry-theme-object                 # dry run (default)
 *   pnpm sanity migrations run entry-theme-object --no-dry-run    # execute against the dataset
 */
export default defineMigration({
  title: 'Fold entry themeColor/themeColorDark/fontKey into the theme object',
  documentTypes: ['entry'],
  // Idempotent at the query layer: only touch entries that still carry the flat color and have no
  // `theme` object yet. This also skips the `now` entries (no `themeColor`) for free.
  filter: 'defined(themeColor) && !defined(theme)',
  migrate: {
    document(doc) {
      const legacy = doc as Record<string, unknown>
      // Re-check in code, aligned with the GROQ `filter` so the two agree exactly: `!= null`
      // no-ops only a doc that already holds a real (non-null) theme object — matching
      // `!defined(theme)`, for which GROQ's `defined(null)` is false. So a `theme: null` doc
      // (reachable only via a raw API write) still migrates rather than stranding half-done, and
      // a `themeColor` that isn't a string is skipped defensively.
      if (legacy.theme != null || typeof legacy.themeColor !== 'string') return []

      const theme: {color: string; colorDark?: string; bodyFont?: string} = {
        color: legacy.themeColor,
      }
      // Carry the optional keys only when present — never write an absent key as `undefined`.
      if (typeof legacy.themeColorDark === 'string') theme.colorDark = legacy.themeColorDark
      if (typeof legacy.fontKey === 'string') theme.bodyFont = legacy.fontKey

      return [
        at('theme', set(theme)),
        at('themeColor', unset()),
        at('themeColorDark', unset()),
        at('fontKey', unset()),
      ]
    },
  },
})
