import {defineField, defineType} from 'sanity'

/**
 * Pull-quote block — a structured editorial quotation.
 *
 * Distinct from the inline `blockquote` text style (a styled paragraph inside a prose
 * `block`): this is a first-class block the author composes into the body, carrying the
 * quoted `text` plus an optional `attribution`. The serializer renders it as a semantic
 * <blockquote> with a <cite>.
 */
export const quote = defineType({
  name: 'quote',
  title: 'Quote',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Quote',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'attribution',
      title: 'Attribution',
      type: 'string',
      description: 'Optional — who said or wrote it.',
    }),
  ],
  preview: {
    select: {title: 'text', subtitle: 'attribution'},
    prepare({title, subtitle}) {
      return {
        title: title ? `“${title}”` : 'Quote',
        subtitle: subtitle ? `— ${subtitle}` : undefined,
      }
    },
  },
})
