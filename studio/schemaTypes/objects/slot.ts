import {defineField, defineType} from 'sanity'

import {laneField} from '../shared/lane'

/**
 * Generic themeable-slot block — the DEFAULT in-essay interactive slot.
 *
 * Stores only a `slotKey` (resolved to a coded component in app code) plus an
 * editor-authored `caption`. Use this whenever the only authored inputs are
 * key + caption — adding a new widget is then zero schema change. Reach for a
 * dedicated typed block (e.g. `figure`) ONLY when an editor must author
 * structured *content*. NEVER model code-level config (variants, initial
 * state) here — default it in the registry, or split into two registered keys.
 *
 * Presentation click-to-edit targets the caption / slotKey fields, NOT
 * the rendered interactive region. `slotKey` is stega-excluded in the client
 * (src/sanity/lib/stega.ts) because it is resolved against code by key and
 * invisible stega chars would break the lookup.
 */
export const slot = defineType({
  name: 'slot',
  title: 'Slot',
  type: 'object',
  fields: [
    defineField({
      name: 'slotKey',
      title: 'Slot key',
      type: 'string',
      description: 'Name of the component to mount — ask a developer for the valid keys.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'caption',
      type: 'string',
      description: 'Optional caption shown beneath the slot.',
    }),
    laneField(),
  ],
  preview: {
    select: {title: 'slotKey', subtitle: 'caption'},
    prepare({title, subtitle}) {
      return {title: title ? `Slot: ${title}` : 'Slot', subtitle: subtitle ?? undefined}
    },
  },
})
