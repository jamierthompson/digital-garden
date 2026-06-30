import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import type {StructureResolver} from 'sanity/structure'
import {presentationTool, defineLocations} from 'sanity/presentation'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

/**
 * Singleton document types — excluded from the default document-type list so
 * editors cannot create duplicates. Each gets a fixed documentId via
 * S.document().documentId(...), which is the canonical Sanity v6 singleton
 * pattern.
 */
const SINGLETONS = ['siteSettings']

const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Site settings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),

      S.divider(),

      ...S.documentTypeListItems().filter(
        (listItem) => !SINGLETONS.includes(listItem.getId() as string),
      ),
    ])

/**
 * Front-end origin the Presentation tool loads in its iframe. Overridable per
 * Studio deployment via the `SANITY_STUDIO_PREVIEW_URL` env var (Studio-scoped:
 * Sanity only exposes vars prefixed `SANITY_STUDIO_` to the bundle). Defaults to
 * the local Next.js app — never hardcode a production URL. See studio/.env.example.
 */
const PREVIEW_URL = process.env.SANITY_STUDIO_PREVIEW_URL || 'http://localhost:3000'

/**
 * Document locations power the "Used on" panel and Structure↔Presentation
 * navigation: they map a document to the front-end route(s) where it appears.
 *
 * - `project` → its own detail page at `/work/<slug>` (src/app/work/[slug]/page.tsx),
 *   plus the `/work` index it's listed on.
 * - `note` → the `/notes` index (there is no per-note route today; notes render
 *   inline on that list — src/app/notes/page.tsx).
 * - `siteSettings` is global (used on every page), so it shows a message instead
 *   of links.
 */
const locations = {
  project: defineLocations({
    select: {title: 'title', slug: 'slug.current'},
    resolve: (doc) => {
      // The "Used on" panel resolves locations for DRAFTS too, where a
      // just-created project may have a title but no slug yet (slug.required()
      // is publish-time validation, not a draft-resolve guarantee). Only emit
      // the /work/<slug> detail link when a non-empty slug exists — otherwise
      // it would point at /work/undefined or /work/ (both 404). The /work index
      // link is always valid.
      const slug = doc?.slug
      return {
        locations: [
          ...(slug ? [{title: doc?.title || 'Untitled project', href: `/work/${slug}`}] : []),
          {title: 'Work index', href: '/work'},
        ],
      }
    },
  }),
  note: defineLocations({
    select: {title: 'title'},
    resolve: (doc) => ({
      locations: [{title: doc?.title || 'Notes', href: '/notes'}],
    }),
  }),
  siteSettings: defineLocations({
    message: 'Used on every page (site-wide settings).',
    tone: 'caution',
  }),
}

export default defineConfig({
  name: 'default',
  title: 'digital-garden',

  projectId: '7id6sf36',
  dataset: 'production',

  plugins: [
    structureTool({structure}),
    /**
     * Presentation tool — the in-product Preview entry point. Loads the front-end
     * (`previewUrl.initial`) in an iframe and toggles Draft Mode via the app's route
     * handlers (src/app/api/draft-mode/*); the enable handler validates Presentation's
     * signed secret via next-sanity's `defineEnableDraftMode` (wrapping
     * `@sanity/preview-url-secret`).
     *
     * API note: `previewUrl.initial` + `previewUrl.previewMode` are the current
     * (sanity@6.1.0) keys; the older `origin` / `draftMode` keys are deprecated.
     */
    presentationTool({
      previewUrl: {
        initial: PREVIEW_URL,
        previewMode: {
          enable: '/api/draft-mode/enable',
          disable: '/api/draft-mode/disable',
        },
      },
      resolve: {locations},
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },
})
