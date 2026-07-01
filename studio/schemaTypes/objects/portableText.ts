import {defineArrayMember, defineType} from 'sanity'

/**
 * Reusable rich-text (Portable Text) body.
 *
 * Standard text blocks + the generic `liveEmbed` (the default embed) + the
 * typed editorial `figure` block. It is the shared `entry.body` surface, so the
 * in-body authoring experience is identical for every kind (note · essay · project).
 */
export const portableText = defineType({
  name: 'portableText',
  title: 'Rich text',
  type: 'array',
  of: [
    defineArrayMember({type: 'block'}),
    defineArrayMember({type: 'liveEmbed'}),
    defineArrayMember({type: 'figure'}),
  ],
})
