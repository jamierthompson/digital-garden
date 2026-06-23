import {defineField, defineType} from 'sanity'

/**
 * Inline figure — a typed editorial block. [D15]
 *
 * This is the case D15 reserves a typed block for: genuine editorial *content*
 * the editor authors and curates — they pick an image asset and write its alt
 * text + caption. Contrast with the generic `liveEmbed` (just key + caption),
 * which is the default for everything that is merely a key reference.
 */
export const figure = defineType({
  name: 'figure',
  title: 'Figure',
  type: 'image',
  options: {hotspot: true},
  fields: [
    defineField({
      name: 'alt',
      title: 'Alternative text',
      type: 'string',
      description: 'Describes the image for screen readers and when it fails to load.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'caption',
      type: 'string',
      description: 'Optional visible caption.',
    }),
  ],
})
