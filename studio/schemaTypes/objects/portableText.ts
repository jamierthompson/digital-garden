import {defineArrayMember, defineType} from 'sanity'

/**
 * Reusable rich-text (Portable Text) body. [§6, D15]
 *
 * Standard text blocks + the generic `liveEmbed` (the default embed) + the
 * typed editorial `figure` block. Shared by `project.essay` and `note.body`
 * so the in-essay authoring surface is identical across both.
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
