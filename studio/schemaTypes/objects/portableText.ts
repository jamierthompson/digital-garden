import {defineArrayMember, defineType} from 'sanity'

/**
 * Reusable rich-text (Portable Text) body.
 *
 * The shared `entry.body` surface — ONE palette for every kind (note · essay · demo ·
 * now), so the in-body authoring experience is identical throughout. `kind` places an entry;
 * it does not restrict the palette. The palette: prose (`block`) · `figure` · `video` · the
 * generic themeable `slot` · `quote`.
 */
export const portableText = defineType({
  name: 'portableText',
  title: 'Rich text',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      // Explicit styles REPLACE the Sanity defaults (verified against @sanity/schema 6.4.0): drop
      // the inline `blockquote` style so the typed `quote` block is the ONE way to pull-quote, and
      // drop H1 — the body renders under the page's `<h1>` entry title, so a body H1 is a
      // double-h1 outline break (WCAG 1.3.1). `lists`/`marks` are left unspecified: omitting them
      // keeps the defaults (bullet/number lists, decorators, and the link annotation).
      styles: [
        {title: 'Normal', value: 'normal'},
        {title: 'Heading 2', value: 'h2'},
        {title: 'Heading 3', value: 'h3'},
      ],
    }),
    defineArrayMember({type: 'figure'}),
    defineArrayMember({type: 'video'}),
    defineArrayMember({type: 'slot'}),
    defineArrayMember({type: 'quote'}),
  ],
})
