import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '7id6sf36',
    dataset: 'production'
  },
  // Pin the hosted Studio hostname so `sanity deploy` is non-interactive and
  // reproducible (incl. from CI): the Studio deploys to
  // https://jamiethompson-garden.sanity.studio.
  studioHost: 'jamiethompson-garden',
  deployment: {
    autoUpdates: true,
    // Pins this deployment to its Sanity application, so future `sanity deploy`
    // runs don't re-prompt for the app id and version selection is fine-grained.
    appId: 'nzwhhl4z1w9uli39dnvrkz9b',
  },
  // Generate types for the frontend (repo root) from this Studio's schema.
  typegen: {
    path: '../src/**/*.{ts,tsx,js,jsx}',
    schema: 'schema.json',
    generates: '../sanity.types.ts',
    overloadClientMethods: true,
  },
})
