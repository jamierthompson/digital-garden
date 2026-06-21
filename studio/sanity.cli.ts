import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '7id6sf36',
    dataset: 'production'
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
  // Generate types for the frontend (repo root) from this Studio's schema.
  typegen: {
    path: '../src/**/*.{ts,tsx,js,jsx}',
    schema: 'schema.json',
    generates: '../sanity.types.ts',
    overloadClientMethods: true,
  },
})
