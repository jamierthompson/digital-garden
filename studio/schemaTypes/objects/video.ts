import {defineField, defineType} from 'sanity'

/**
 * Video block — a referenced video, authored as a URL plus an optional caption.
 *
 * A typed editorial media block, sibling to `figure`. Like the figure placeholder, the
 * serializer renders a labelled placeholder + caption rather than standing up a
 * provider/embed pipeline before a project needs one (the "name the destination,
 * instantiate late" discipline; a real embed is deferred — see #128).
 */
export const video = defineType({
  name: 'video',
  title: 'Video',
  type: 'object',
  fields: [
    defineField({
      name: 'url',
      title: 'Video URL',
      type: 'url',
      description: 'Link to the video — a hosted file or a provider URL.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'caption',
      type: 'string',
      description: 'Optional visible caption.',
    }),
  ],
  preview: {
    select: {title: 'caption', subtitle: 'url'},
    prepare({title, subtitle}) {
      return {title: title || 'Video', subtitle: subtitle ?? undefined}
    },
  },
})
