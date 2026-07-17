import {defineArrayMember, defineField, defineType} from 'sanity'

import {isThemeColorString} from '../shared/colorValidation'
import {forbiddenForNow} from './entryValidators'

/**
 * An `entry` — the single content type for the whole garden.
 *
 * Notes, essays, demos, and nows are the same shape (a themed page with one or more
 * interactive slots plus prose), so they are ONE document type discriminated by a
 * `kind` field — not four types, and not a merge that erased the distinction. `kind`
 * groups the Index into its labelled sections and routes an entry to its surface; the kinds
 * differ by scope and emphasis, not fields. See docs/architecture.md → Content model.
 *
 * An entry carries ONE first-class `theme` object — `{ color, colorDark, headingFont, bodyFont,
 * monoFont }` — a named, reference-by-key thing consumed by code, NOT prose (see the stega
 * exclusions in src/sanity/lib/stega.ts, which exclude the whole object by ancestor). `color`
 * dresses the page chrome and every interactive slot; the three font faces name the roster faces
 * the slot's type wears — heading, body, and mono, each independent; `colorDark` is an optional
 * hand-tuned dark override. Under the site-wide engine-theming model (#166) every page derives its
 * theme from an authored seed — but the seed need not be the entry's OWN: `theme.color` is
 * OPTIONAL for the themed kinds (note, essay, demo, now), and an entry that authors none wears the
 * site default theme (`siteSettings.theme`). The three font faces are each OPTIONAL for every
 * kind — an absent face inherits the site type palette, so a slot with no font override wears the
 * constant site faces.
 * `componentKey` is SEPARATE from the theme (it MOUNTS a module; it is not part of the theme the
 * module reads), so it stays a top-level field — also OPTIONAL, mounting a module purely on its
 * PRESENCE for any kind, `now` included. A `now` can hold slots and modules like any editorial
 * entry but never wears its OWN theme — its whole `theme` object is hidden and it CANNOT set a
 * color (the single `/now` page seed themes all `now` content: the `/now` index and every `now`
 * entry, resolved in ENTRY_DETAIL_QUERY); `forbiddenForNow` rejects a color on a `now`.
 *
 * NOTE: the three font faces and `componentKey` are plain string fields here on purpose — the
 * standalone Studio bundle must not import app code (keys.ts / next/font / lazy slot bundles).
 */
const KINDS = [
  {title: 'Note', value: 'note'},
  {title: 'Essay', value: 'essay'},
  {title: 'Demo', value: 'demo'},
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
      initialValue: 'demo',
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
      name: 'summary',
      type: 'text',
      rows: 3,
      description:
        'Authored standalone summary — written for the cards, lists, and feed, not a paste of the opening paragraph.',
      // Two tiers need two Rules: chaining `.warning()` then `.error()` re-levels the SAME
      // rule (last call wins), which made the 280 soft cap block publish at error level.
      validation: (rule) => [
        rule.max(280).warning('Keep the summary card-sized.'),
        rule
          .max(300)
          .error('Summary exceeds the 300-character hard cap — the card layout cannot absorb the overflow.'),
      ],
    }),

    // The entry's theme: one first-class object, reference-by-key, consumed by code, stega-
    // excluded by ancestor. Every field is optional — an absent `color` wears the site default
    // theme, and an absent font face (headingFont/bodyFont/monoFont) inherits the site type
    // palette. The whole object is hidden for a `now` update, which inherits the /now page
    // seed instead.
    defineField({
      name: 'theme',
      title: 'Theme',
      type: 'object',
      // Hidden for a `now` update, mirroring `stage`: a `now` inherits the /now page seed, so it
      // has no theme of its own to author. Hiding is UX; `forbiddenForNow` on `color`/`colorDark`
      // is the belt that guards the API/import path.
      hidden: ({document}) => document?.kind === 'now',
      fields: [
        defineField({
          name: 'color',
          title: 'Theme color',
          type: 'string',
          description:
            'Hex or oklch() accent that dresses this entry’s page chrome and every interactive slot. Leave empty to inherit the site default theme.',
          validation: (rule) => rule.custom(forbiddenForNow).custom(isThemeColorString),
        }),
        defineField({
          name: 'colorDark',
          title: 'Theme color (dark override)',
          type: 'string',
          description:
            'Optional dark-mode override. Leave empty to derive it automatically from the theme color.',
          validation: (rule) => rule.custom(forbiddenForNow).custom(isThemeColorString),
        }),
        defineField({
          name: 'headingFont',
          title: 'Heading font key',
          type: 'string',
          description:
            'Optional. Name of the roster font this entry’s slot headings wear — ask a developer for the valid keys. Leave empty to inherit the site heading face.',
        }),
        defineField({
          name: 'bodyFont',
          title: 'Body font key',
          type: 'string',
          description:
            'Optional. Name of the roster font this entry’s slot body text wears — ask a developer for the valid keys. Leave empty to inherit the site body face.',
        }),
        defineField({
          name: 'monoFont',
          title: 'Mono font key',
          type: 'string',
          description:
            'Optional. Name of the roster font this entry’s slot monospace text wears — ask a developer for the valid keys. Leave empty to inherit the site mono face.',
        }),
      ],
    }),
    defineField({
      name: 'componentKey',
      title: 'Component key',
      type: 'string',
      description:
        'Optional. Name of the coded component this entry mounts — ask a developer for the valid keys. Setting it mounts that component (a demo’s sidebar controls + canvas, or an editorial entry’s slots); leave empty for a prose-only entry.',
    }),

    defineField({
      name: 'body',
      title: 'Body',
      type: 'portableText',
      // A demo has no prose article (its template is sidebar + canvas; the summary is its
      // prose) — the field hides for demos and `required` binds only to editorial kinds.
      hidden: ({document}) => document?.kind === 'demo',
      validation: (rule) =>
        rule.custom((value, context) => {
          if (context.document?.kind === 'demo') return true
          return value ? true : 'Required for editorial entries (note · essay · now)'
        }),
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
