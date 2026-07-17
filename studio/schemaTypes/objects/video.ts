import {defineField, defineType} from 'sanity'

import {laneField} from '../shared/lane'

/**
 * Video block — a referenced video, authored as a URL plus an optional caption.
 *
 * A typed editorial media block, sibling to `figure`. The serializer resolves the URL through a
 * security-critical allow-list (this field is validated here, but a raw Content Lake write can
 * bypass that): a provider URL renders an iframe embed, a hosted media file a native `<video>`,
 * and anything failing the checks the labelled placeholder — the URL never reaches a `src`
 * unvalidated (#263).
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
    laneField(),
  ],
  preview: {
    select: {title: 'caption', subtitle: 'url'},
    prepare({title, subtitle}) {
      return {title: title || 'Video', subtitle: subtitle ?? undefined}
    },
  },
})
