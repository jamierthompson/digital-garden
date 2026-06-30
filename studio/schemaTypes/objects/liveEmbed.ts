import {defineField, defineType} from 'sanity'

/**
 * Generic live-embed block — the DEFAULT in-essay embed.
 *
 * Stores only an `embedKey` (resolved to a coded component in app code) plus an
 * editor-authored `caption`. Use this whenever the only authored inputs are
 * key + caption — adding a new widget is then zero schema change. Reach for a
 * dedicated typed block (e.g. `figure`) ONLY when an editor must author
 * structured *content*. NEVER model code-level config (variants, initial
 * state) here — default it in the registry, or split into two registered keys.
 *
 * Presentation click-to-edit targets the caption / embedKey fields, NOT
 * the rendered interactive region. `embedKey` is stega-excluded in the client
 * (src/sanity/lib/client.ts) because it is resolved against code by key and
 * invisible stega chars would break the lookup.
 */
export const liveEmbed = defineType({
  name: 'liveEmbed',
  title: 'Live embed',
  type: 'object',
  fields: [
    defineField({
      name: 'embedKey',
      title: 'Embed key',
      type: 'string',
      description:
        'Key of the coded component to embed, resolved in app code against the embed registry — not a free-text label. The picker is wired to keys.ts in a later slice.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'caption',
      type: 'string',
      description: 'Optional caption shown beneath the embed.',
    }),
  ],
  preview: {
    select: {title: 'embedKey', subtitle: 'caption'},
    prepare({title, subtitle}) {
      return {title: title ? `Embed: ${title}` : 'Live embed', subtitle: subtitle ?? undefined}
    },
  },
})
