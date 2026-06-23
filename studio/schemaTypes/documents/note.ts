import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * A digital-garden note. [§6]
 *
 * Lightweight rich-text note. Inter-note backlinks are modelled as REAL
 * Sanity `reference` fields (not free-text slugs) so `references()` resolves
 * and link integrity is datastore-enforced — string keys would reintroduce
 * key-drift. [D16]
 */
export const note = defineType({
  name: 'note',
  title: 'Note',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'portableText',
      description: 'The note content — same rich-text surface as a project essay.',
    }),
    defineField({
      name: 'related',
      title: 'Related notes',
      type: 'array',
      description:
        'Backlinks to other notes via real references (not slug strings) so references() resolves. [D16]',
      of: [defineArrayMember({type: 'reference', to: [{type: 'note'}]})],
    }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'slug.current'},
  },
})
