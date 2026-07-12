import {defineArrayMember, defineType} from 'sanity'

/**
 * Reusable rich-text (Portable Text) body.
 *
 * The shared `entry.body` surface — ONE palette for every kind (note · essay · project ·
 * now), so the in-body authoring experience is identical throughout. `kind` places an entry;
 * it does not restrict the palette. The palette: prose (`block`) · `figure` · `video` · the
 * generic themeable `slot` · `quote`.
 */
export const portableText = defineType({
  name: 'portableText',
  title: 'Rich text',
  type: 'array',
  of: [
    defineArrayMember({type: 'block'}),
    defineArrayMember({type: 'figure'}),
    defineArrayMember({type: 'video'}),
    defineArrayMember({type: 'slot'}),
    defineArrayMember({type: 'quote'}),
  ],
})
