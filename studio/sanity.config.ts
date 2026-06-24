import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import type {StructureResolver} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

/**
 * Singleton document types — excluded from the default document-type list so
 * editors cannot create duplicates. Each gets a fixed documentId via
 * S.document().documentId(...), which is the canonical Sanity v6 singleton
 * pattern. [D24]
 */
const SINGLETONS = ['siteSettings']

const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      // Singleton: site-wide settings. Fixed documentId prevents duplicates.
      S.listItem()
        .title('Site settings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),

      S.divider(),

      // All remaining document types, excluding singletons to avoid duplication.
      ...S.documentTypeListItems().filter(
        (listItem) => !SINGLETONS.includes(listItem.getId() as string),
      ),
    ])

export default defineConfig({
  name: 'default',
  title: 'digital-garden',

  projectId: '7id6sf36',
  dataset: 'production',

  plugins: [structureTool({structure}), visionTool()],

  schema: {
    types: schemaTypes,
  },
})
