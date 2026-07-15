import {at, defineMigration, set, setIfMissing, unset} from 'sanity/migrate'

/**
 * Rename each entry's `blurb` to `summary` and the kind value `project` to `demo` (#312).
 *
 * The schema, GROQ, and app flipped to `summary` / `demo` in the same slice, so the
 * `production` dataset must be reshaped in lockstep. Per entry this copies `blurb` into
 * `summary` (`setIfMissing`, so an already-authored summary is never clobbered) and UNSETs
 * the retired key, and rewrites `kind: "project"` to `"demo"`. It is idempotent: the GROQ
 * `filter` skips any doc that carries neither the old field nor the old kind value, and the
 * in-code guards re-check per patch so a re-run is a no-op. Runs on raw documents — drafts
 * migrate in place and are NOT published (an in-flight draft keeps its unpublished edits).
 *
 * Run it as the deploy promotes so schema + code + data cut over together (until it runs,
 * the new code renders old docs with no summary and an empty Demos section — degraded, never
 * a crash). From `studio/`, dry-run first, then execute:
 *
 *   pnpm sanity migrations run summary-and-demo-kind                 # dry run (default)
 *   pnpm sanity migrations run summary-and-demo-kind --no-dry-run    # execute against the dataset
 */
export default defineMigration({
  title: 'Rename entry blurb to summary and kind project to demo',
  documentTypes: ['entry'],
  filter: 'defined(blurb) || kind == "project"',
  migrate: {
    document(doc) {
      const legacy = doc as Record<string, unknown>
      const patches = []
      if (legacy.blurb !== undefined && legacy.blurb !== null) {
        patches.push(at('summary', setIfMissing(legacy.blurb)), at('blurb', unset()))
      }
      if (legacy.kind === 'project') {
        patches.push(at('kind', set('demo')))
      }
      return patches
    },
  },
})
