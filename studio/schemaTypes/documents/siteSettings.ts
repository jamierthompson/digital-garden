import {defineField, defineType} from 'sanity'

import {isThemeColorString} from '../shared/colorValidation'

/**
 * Shell / digital-garden settings — a singleton (enforced via Studio Structure in
 * `sanity.config.ts`).
 *
 * Two concerns, kept separate:
 *   • Shell identity — `title` / `description`, read by `generateMetadata` (src/app/layout.tsx).
 *   • Per-page theme seeds — `pageThemes`, one authored theme color per site-owned page
 *     (`/`, `/browse`, `/about`, `/now`, `/system`). Under the site-wide engine-theming model
 *     (#166), every page derives its theme from an authored OKLCH seed: an `entry` seeds from
 *     its own `themeColor`, and these site-owned pages — which have no backing `entry` — seed
 *     from here. A `now`-kind entry has no `themeColor` of its own and inherits the `/now` seed
 *     (`pageThemes.now`), resolved in `ENTRY_DETAIL_QUERY`. Dark mode is auto-derived by the
 *     engine, so there is no per-page dark override.
 *
 * Each seed is a plain string (hex or `oklch()`) validated by the engine's OWN pipeline
 * (`isThemeColorString` → `buildTokenSet`), NOT a color-picker: the author-time check is
 * exactly the render-time contract, and `oklch()` authoring stays available. These are
 * capability values consumed by code, not prose — stega-excluded alongside the entry seeds.
 */
const themeSeedField = (name: string, title: string, page: string) =>
  defineField({
    name,
    title,
    type: 'string',
    description: `Theme seed color for ${page} — hex or oklch(). The engine derives this page’s theme from it (dark mode auto-derived).`,
    validation: (rule) => rule.required().custom(isThemeColorString),
  })

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      description: 'Site / garden name.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 3,
      description: 'Shell tagline / default meta description.',
    }),
    defineField({
      name: 'pageThemes',
      title: 'Page themes',
      type: 'object',
      description:
        'Authored theme seed color for each site-owned page. The OKLCH engine derives each page’s theme from its seed; a “now” entry inherits the /now seed.',
      options: {collapsible: true, collapsed: false},
      fields: [
        themeSeedField('home', 'Home ( / )', 'the / home page'),
        themeSeedField('browse', 'Browse ( /browse )', 'the /browse page'),
        themeSeedField('about', 'About ( /about )', 'the /about page'),
        themeSeedField('now', 'Now ( /now )', 'the /now page (also inherited by “now” entries)'),
        themeSeedField('system', 'System ( /system )', 'the /system page'),
      ],
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Site settings'}
    },
  },
})
