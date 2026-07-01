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
 * - `entry` → its flat detail page (`/<slug>`) + the browsable Index (`/browse`) it's listed
 *   on. Every kind now folds into the one Index.
 * - `siteSettings` is global (used on every page), so it shows a message instead
 *   of links.
 */
const locations = {
  entry: defineLocations({
    select: {title: 'title', slug: 'slug.current', kind: 'kind'},
    resolve: (doc) => {
      // The "Used on" panel resolves locations for DRAFTS too, where a just-created
      // entry may have a title but no slug yet (slug.required() is publish-time
      // validation, not a draft-resolve guarantee). Only emit the /<slug> detail link
      // when a non-empty slug exists — otherwise it points at /undefined (404).
      const slug = doc?.slug
      const detail = slug
        ? [{title: doc?.title || 'Untitled entry', href: `/${slug}`}]
        : []
      return {locations: [...detail, {title: 'Index', href: '/browse'}]}
    },
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
