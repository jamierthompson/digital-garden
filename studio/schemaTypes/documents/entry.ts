import {defineArrayMember, defineField, defineType, type ValidationContext} from 'sanity'

import {isBrandColorString} from '../shared/colorValidation'

/**
 * An `entry` — the single content type for the whole garden.
 *
 * Notes, essays, and projects are the same shape (a themed page with one or more
 * interactive slots plus prose), so they are ONE document type discriminated by a
 * `kind` field — not three types, and not a merge that erased the distinction. `kind`
 * drives the Index's type filter and the on-card label; the kinds differ by scope and
 * emphasis, not fields. See docs/architecture.md → Content model.
 *
 * Theming seeds (`brandColor` / `fontKey` / `componentKey`) are reference-by-key values
 * consumed by code, NOT prose — see the stega exclusions in src/sanity/lib/client.ts.
 * They are **conditionally required for a `project`** and optional for a note/essay (a
 * note only needs them when it themes an embedded component).
 *
 * NOTE: `componentKey` / `fontKey` are plain string fields here on purpose — the
 * standalone Studio bundle must not import app code (keys.ts / next/font / lazy project
 * bundles). A dropdown wired to the shared keys.ts contract is a later slice.
 */
const KINDS = [
  {title: 'Note', value: 'note'},
  {title: 'Essay', value: 'essay'},
  {title: 'Project', value: 'project'},
  {title: 'Now', value: 'now'},
] as const

const STAGES = [
  {title: 'Sketch', value: 'sketch'},
  {title: 'Prototype', value: 'prototype'},
  {title: 'Shipped', value: 'shipped'},
] as const

/** Sibling-`kind` read shared by the conditional-required validators below. */
function requiredForProject(value: unknown, context: ValidationContext): true | string {
  const kind = (context.document as {kind?: unknown} | undefined)?.kind
  return kind === 'project' && !value ? 'Required for a project.' : true
}

export const entry = defineType({
  name: 'entry',
  title: 'Entry',
  type: 'document',
  fields: [
    defineField({
      name: 'kind',
      type: 'string',
      description:
        'Note (small, single-subject, often one component) · Essay (writing-led, interactions slotted in) · Project (an interactive experience) · Now (a dated “now” update). Drives the Index filter and the card label.',
      options: {list: [...KINDS], layout: 'radio'},
      initialValue: 'project',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      // The slug keys the theme scope selector `[data-project="<slug>"]` AND the hoisted
      // `<style>` href on a themed slot, so it MUST be CSS-safe and unique per entry — a
      // stray `.` / `_` / unicode / duplicate would collide two entries onto one theme
      // (React de-dupes styles by href). Every entry shares one flat slug namespace
      // (flat top-level routes), so uniqueness across the type is uniqueness across kinds.
      options: {
        source: 'title',
        maxLength: 96,
        slugify: (input) =>
          input
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-+|-+$)/g, '')
            .slice(0, 96),
      },
      validation: (rule) =>
        rule
          .required()
          .custom((slug) =>
            !slug?.current
              ? 'Required'
              : /^[a-z0-9-]+$/.test(slug.current) ||
                'Use only lowercase letters, numbers, and hyphens — the slug keys the theme scope.',
          ),
    }),
    defineField({
      name: 'stage',
      type: 'string',
      description:
        'Maturity badge (the honesty signal): sketch → prototype → shipped. Independent of kind and of featuredRank. Not applicable to a “now” update.',
      options: {list: [...STAGES], layout: 'radio'},
      initialValue: 'sketch',
      hidden: ({document}) => document?.kind === 'now',
      validation: (rule) =>
        rule.custom((value, context) => {
          const kind = (context.document as {kind?: unknown} | undefined)?.kind
          return kind !== 'now' && !value ? 'Required (except for a “now” update).' : true
        }),
    }),
    defineField({
      name: 'iterated',
      title: 'Last iterated',
      type: 'date',
      description:
        'Authored “last worked on” date — an intentional signal of a living, tended piece. NOT the automatic _updatedAt.',
    }),
    defineField({
      name: 'featuredRank',
      title: 'Featured rank',
      type: 'number',
      description:
        'Set to feature this entry on the homepage front door (any kind). The value orders the featured list (lower = earlier). Leave empty to keep it out of the front door.',
      validation: (rule) => rule.integer(),
    }),
    defineField({
      name: 'blurb',
      type: 'text',
      rows: 3,
      description:
        'Short summary for the index card. NOT the body — the index query pulls this, never the body.',
      validation: (rule) =>
        rule
          .max(280)
          .warning('Keep the blurb card-sized.')
          .max(300)
          .error('Blurb exceeds the 300-character hard cap — the card layout cannot absorb the overflow.'),
    }),

    // Theming seeds: reference-by-key, consumed by code, stega-excluded.
    // brandColor / fontKey / componentKey are conditionally required for a project.
    defineField({
      name: 'brandColor',
      title: 'Brand color',
      type: 'string',
      description:
        'Per-slot seed for the OKLCH engine — hex or oklch(). One value generates BOTH light & dark ramps. Required for a project; optional for a note/essay that themes an embedded component.',
      validation: (rule) => rule.custom(requiredForProject).custom(isBrandColorString),
    }),
    defineField({
      name: 'brandColorDark',
      title: 'Brand color (dark override)',
      type: 'string',
      description:
        'OPTIONAL hand-tuned dark-scheme seed. Leave empty to let the engine derive dark from brandColor — never a required parallel field.',
      validation: (rule) => rule.custom(isBrandColorString),
    }),
    defineField({
      name: 'fontKey',
      title: 'Font key',
      type: 'string',
      description:
        'Key of the curated roster face, resolved in app code (fonts/roster.ts). Required for a project; optional otherwise.',
      validation: (rule) => rule.custom(requiredForProject),
    }),
    defineField({
      name: 'componentKey',
      title: 'Component key',
      type: 'string',
      description:
        'Key of the coded module this entry mounts, resolved in app code (src/lib/resolvers/components.ts). Required for a project; optional for a note/essay.',
      validation: (rule) => rule.custom(requiredForProject),
    }),

    defineField({
      name: 'body',
      title: 'Body',
      type: 'portableText',
      description:
        'The write-up. Embed live components with the Live embed block (default); pick images with Figure.',
    }),
    defineField({
      name: 'related',
      title: 'Related entries',
      type: 'array',
      description:
        'Backlinks to other entries via real references (not slug strings) so references() resolves — the graph is cross-kind and datastore-enforced.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'entry'}]})],
    }),
  ],
  preview: {
    select: {title: 'title', kind: 'kind', stage: 'stage'},
    prepare: ({title, kind, stage}) => ({
      title,
      subtitle: [kind, stage].filter(Boolean).join(' · '),
    }),
  },
})
