import {defineField, defineType} from 'sanity'

/**
 * Shell / digital-garden settings.
 *
 * Shell identity only: the site title and default meta description that
 * `generateMetadata` reads (src/app/layout.tsx). The shell is static and
 * monochromatic — it wears the global editorial layer, NOT a Sanity-seeded brand — so
 * this singleton carries no theming fields; brand color + font live on each `entry` and
 * theme only that entry's own slot. Enforced as a singleton via Studio Structure
 * (structureTool config in sanity.config.ts).
 */
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
  ],
  preview: {
    prepare() {
      return {title: 'Site settings'}
    },
  },
})
