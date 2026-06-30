import {defineField, defineType} from 'sanity'

/**
 * Inline figure — a typed editorial block.
 *
 * This is the case a typed block is reserved for: genuine editorial *content*
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
