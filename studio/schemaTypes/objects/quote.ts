import {defineField, defineType} from 'sanity'

/**
 * Pull-quote block — a structured, attributed quotation set apart from the prose.
 *
 * A first-class block the author composes into the body, carrying the quoted `text` plus an
 * optional `attribution` — distinct from the inline `blockquote` text style (a styled paragraph
 * within a prose `block`, which has no attribution). The serializer renders it as a semantic
 * <figure> wrapping a <blockquote>, with any attribution in an outside <figcaption>.
 */
export const quote = defineType({
  name: 'quote',
  title: 'Pull quote',
  type: 'object',
  description:
    'A standalone, attributed quotation set apart from the prose. To quote a passage inline within a paragraph, use the Quote block style instead.',
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
