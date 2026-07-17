import {defineField} from 'sanity'

/**
 * The content-grid lane a body block occupies — shared by the media/slot block types
 * (`figure`, `video`, `slot`). Absent means the code default (`wide`); `full` is the
 * deliberate edge-to-edge opt-in; `prose` tucks a small block into the reading column.
 * The app sanitizes unknown values back to `wide`, so this list can grow without
 * breaking older documents.
 */
export const LANES = [
  {title: 'Wide (default)', value: 'wide'},
  {title: 'Full bleed', value: 'full'},
  {title: 'Prose', value: 'prose'},
] as const

export const laneField = () =>
  defineField({
    name: 'lane',
    title: 'Lane',
    type: 'string',
    options: {list: [...LANES], layout: 'radio'},
    initialValue: 'wide',
    description:
      'How wide this block sits — wide (the breakout default), full bleed (edge-to-edge), or the prose measure.',
  })
