import {defineField, defineType} from 'sanity'

import {isThemeColorString} from '../shared/colorValidation'

/**
 * Shell / digital-garden settings — a singleton (enforced via Studio Structure in
 * `sanity.config.ts`).
 *
 * Three concerns, kept separate:
 *   • Shell identity — `title` / `description`, read by `generateMetadata` (src/app/layout.tsx).
 *   • The site default theme — `theme { color, colorDark }`, the SAME shape an entry authors
 *     (#249). The one REQUIRED seed on the whole site: every resolution chain falls back to it,
 *     so anything that authors no seed of its own wears this. `colorDark` is an optional
 *     hand-tuned dark override; dark mode is otherwise auto-derived by the engine.
 *   • Per-page theme seeds — `pageThemes`, an OPTIONAL override per site-owned page
 *     (`/`, `/browse`, `/about`, `/now`, `/system`). Under the site-wide engine-theming model
 *     (#166), every page derives its theme from an authored OKLCH seed: an `entry` seeds from
 *     its own `theme.color`, and these site-owned pages — which have no backing `entry` — seed
 *     from here, falling back to the site default when a page's override is empty. A `now`-kind
 *     entry has no `theme.color` of its own and inherits the `/now` seed (`pageThemes.now`,
 *     itself defaulted), resolved in `ENTRY_DETAIL_QUERY`.
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
    description: `Theme seed color for ${page} — hex or oklch(). Overrides the site default theme; leave empty to inherit it.`,
    validation: (rule) => rule.custom(isThemeColorString),
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
      name: 'theme',
      title: 'Site default theme',
      type: 'object',
      description:
        'The default theme seed the whole site falls back to — any page or entry without its own seed wears this.',
      options: {collapsible: true, collapsed: false},
      fields: [
        defineField({
          name: 'color',
          title: 'Theme color',
          type: 'string',
          description:
            'Hex or oklch() seed the engine derives the site default theme from (dark mode auto-derived).',
          validation: (rule) => rule.required().custom(isThemeColorString),
        }),
        defineField({
          name: 'colorDark',
          title: 'Theme color (dark override)',
          type: 'string',
          description:
            'Optional dark-mode override. Leave empty to derive it automatically from the theme color.',
          validation: (rule) => rule.custom(isThemeColorString),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'pageThemes',
      title: 'Page themes',
      type: 'object',
      description:
        'Optional theme seed override per site-owned page — a page with no override inherits the site default theme. A “now” entry inherits the /now seed.',
      options: {collapsible: true, collapsed: false},
      fields: [
        themeSeedField('home', 'Home ( / )', 'the / home page'),
        themeSeedField('browse', 'Browse ( /browse )', 'the /browse page'),
        themeSeedField('about', 'About ( /about )', 'the /about page'),
        themeSeedField('now', 'Now ( /now )', 'the /now page (also inherited by “now” entries)'),
        themeSeedField('system', 'System ( /system )', 'the /system page'),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Site settings'}
    },
  },
})
