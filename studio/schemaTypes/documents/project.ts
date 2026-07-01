import {defineArrayMember, defineField, defineType} from 'sanity'

import {isBrandColorString} from '../shared/colorValidation'

/**
 * A portfolio / digital-garden project.
 *
 * Holds the essay and references a coded module by key; the CMS never
 * reimplements interaction. Theming seeds (brandColor / fontKey) are
 * reference-by-key values consumed by code, NOT prose — see the stega
 * exclusions in src/sanity/lib/client.ts.
 *
 * NOTE: `componentKey` / `fontKey` are plain string fields here on purpose —
 * the standalone Studio bundle must not import app code (keys.ts / next/font /
 * lazy project bundles). A dropdown wired to the shared keys.ts
 * contract is a later slice owned by the resolver work.
 */
export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      // The slug keys the theme scope selector `[data-project="<slug>"]` AND the hoisted
      // `<style>` href, so it MUST be CSS-safe and unique per project — a stray `.` / `_` /
      // unicode / duplicate would collide two projects onto one theme (React de-dupes styles
      // by href). Slugify to `[a-z0-9-]`, validate the charset, and rely on the `slug` type's
      // `isUnique` (uniqueness across the document type is the default).
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
                'Use only lowercase letters, numbers, and hyphens — the slug keys the project theme scope.',
          ),
    }),
    defineField({
      name: 'blurb',
      type: 'text',
      rows: 3,
      description:
        'Short summary for the /work index card. NOT the essay — the index query pulls this, never the essay.',
      validation: (rule) =>
        rule
          .max(280)
          .warning('Keep the blurb card-sized.')
          .max(300)
          .error('Blurb exceeds the 300-character hard cap — the card layout cannot absorb the overflow.'),
    }),

    // Theming seeds: reference-by-key, consumed by code, stega-excluded.
    defineField({
      name: 'brandColor',
      title: 'Brand color',
      type: 'string',
      description:
        'Per-project island seed for the OKLCH engine — hex or oklch(). One value generates BOTH light & dark ramps.',
      validation: (rule) => rule.required().custom(isBrandColorString),
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
        'Key of the curated roster face, resolved in app code (fonts/roster.ts). Picker wired to keys.ts in a later slice.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'componentKey',
      title: 'Component key',
      type: 'string',
      description:
        'Key of the coded project module, resolved in app code (src/lib/resolvers/components.ts).',
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'essay',
      title: 'Essay',
      type: 'portableText',
      description:
        'The project write-up. Embed live components with the Live embed block (default); pick images with Figure.',
    }),
    defineField({
      name: 'notes',
      title: 'Related notes',
      type: 'array',
      description:
        'Links to digital-garden notes via real references (not slug strings) so references() resolves and integrity is datastore-enforced.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'note'}]})],
    }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'blurb'},
  },
})
