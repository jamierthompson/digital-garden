import {defineField, defineType} from 'sanity'

import {isBrandColorString} from '../shared/colorValidation'

/**
 * Shell / digital-garden settings. [§6]
 *
 * Holds the shell island's brand seed (ProjectScope slug="garden") and shell
 * identity. Enforced as a singleton via Studio Structure (structureTool config in
 * sanity.config.ts). Same brand treatment as
 * a project: stega-excluded seed, engine-validated, defensively rendered. [D9]
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
    defineField({
      name: 'brandColor',
      title: 'Shell brand color',
      type: 'string',
      description:
        'Brand seed for the shell island — hex or oklch(). Same engine treatment as a project; one value drives both schemes. [D5, D9]',
      validation: (rule) => rule.required().custom(isBrandColorString),
    }),
    defineField({
      name: 'brandColorDark',
      title: 'Shell brand color (dark override)',
      type: 'string',
      description:
        'Optional hand-tuned dark-scheme shell brand. The engine derives dark from brandColor when empty. [D5]',
      validation: (rule) => rule.custom(isBrandColorString),
    }),
    defineField({
      name: 'fontKey',
      title: 'Shell font key',
      type: 'string',
      description:
        'Curated roster face for the shell, resolved in app code. Picker wired to keys.ts in a later slice.',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Site settings'}
    },
  },
})
