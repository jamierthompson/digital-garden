import {defineArrayMember, defineField, defineType} from 'sanity'

import {isBrandColorString} from '../shared/colorValidation'
import {forbiddenForNow, requiredForNonSketchProject, requiredForThemedKind} from './entryValidators'

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
 * consumed by code, NOT prose — see the stega exclusions in src/sanity/lib/client.ts. They
 * are CAPABILITY fields: the route themes / mounts a module on their PRESENCE, for any kind
 * except `now`. The required rules below are only a floor: under the site-wide engine-theming
 * model (#166) every page derives its theme from an authored seed, so `brandColor` is required
 * for every THEMED kind — note, essay, AND project (any stage: the project card plate consumes
 * it even for a sketch, and a note/essay page themes from it too). `fontKey` / `componentKey`
 * name a coded module + its face, so they stay required only for a `project` PAST the sketch
 * stage — a `stage: sketch` project is an honest placeholder with no module yet, so it carries a
 * brandColor but no fontKey/componentKey. `fontKey` / `componentKey` remain OPTIONAL-but-honored
 * for a note/essay (one that sets `componentKey` mounts that module). `now` is chrome + prose by
 * design — it CANNOT set a `brandColor` (the single `/now` page seed themes all `now` content: the
 * `/now` index and every `now` entry, resolved in ENTRY_DETAIL_QUERY); `forbiddenForNow` rejects a
 * color on a `now`, and any other theming field it carries is ignored downstream.
 *
 * NOTE: `componentKey` / `fontKey` are plain string fields here on purpose — the
 * standalone Studio bundle must not import app code (keys.ts / next/font / lazy project
 * bundles).
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

export const entry = defineType({
  name: 'entry',
  title: 'Entry',
  type: 'document',
  fields: [
    defineField({
      name: 'kind',
      type: 'string',
      description: '“Now” is a dated update for your now page.',
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
      // The slug keys the theme scope selector `[data-entry="<slug>"]` AND the hoisted
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
    }),
    defineField({
      name: 'featuredRank',
      title: 'Featured rank',
      type: 'number',
      description:
        'Set a number to feature this entry on the homepage — lower numbers show first. Leave empty to keep it off.',
      validation: (rule) => rule.integer(),
    }),
    defineField({
      name: 'blurb',
      type: 'text',
      rows: 3,
      validation: (rule) =>
        rule
          .max(280)
          .warning('Keep the blurb card-sized.')
          .max(300)
          .error('Blurb exceeds the 300-character hard cap — the card layout cannot absorb the overflow.'),
    }),

    // Theming seeds: reference-by-key, consumed by code, stega-excluded. brandColor is required
    // for every themed kind — note, essay, and project (the page/card derives its theme from it);
    // fontKey / componentKey name a coded module + face, so they are required only PAST the sketch
    // stage. A `now` update carries none and inherits the /now page seed.
    defineField({
      name: 'brandColor',
      title: 'Brand color',
      type: 'string',
      description:
        'Hex or oklch() accent that themes this entry’s page and interactive component. Required for every note, essay, and project. (A “now” update inherits the /now page seed and cannot set its own color.)',
      // Hidden for a `now` update, mirroring `stage`: a `now` cannot carry a color (it inherits the
      // /now page seed), so the field is both HIDDEN in the Studio and REJECTED by `forbiddenForNow`
      // — hiding is UX, the validator is the belt that guards the API/import path.
      hidden: ({document}) => document?.kind === 'now',
      validation: (rule) =>
        rule.custom(requiredForThemedKind).custom(forbiddenForNow).custom(isBrandColorString),
    }),
    defineField({
      name: 'brandColorDark',
      title: 'Brand color (dark override)',
      type: 'string',
      description:
        'Optional dark-mode override. Leave empty to derive it automatically from the brand color.',
      // Hidden AND rejected for `now` alongside its paired `brandColor` — a dark override with no
      // base color to override makes no sense on a kind that inherits the /now seed.
      hidden: ({document}) => document?.kind === 'now',
      validation: (rule) => rule.custom(forbiddenForNow).custom(isBrandColorString),
    }),
    defineField({
      name: 'fontKey',
      title: 'Font key',
      type: 'string',
      description:
        'Name of the roster font for this entry’s component — ask a developer for the valid keys. Required for a project past the sketch stage.',
      validation: (rule) => rule.custom(requiredForNonSketchProject),
    }),
    defineField({
      name: 'componentKey',
      title: 'Component key',
      type: 'string',
      description:
        'Name of the coded component this entry mounts — ask a developer for the valid keys. Required for a project past the sketch stage; optional for a note or essay, where setting it also mounts that component.',
      validation: (rule) => rule.custom(requiredForNonSketchProject),
    }),

    defineField({
      name: 'body',
      title: 'Body',
      type: 'portableText',
    }),
    defineField({
      name: 'related',
      title: 'Related entries',
      type: 'array',
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
