import {describe, expect, it} from 'vitest'

import {siteSettings} from './siteSettings'

/**
 * Pins the shell-identity contract at the SCHEMA layer (#142).
 *
 * The shell is static + monochromatic — `siteSettings` carries only the identity fields
 * `generateMetadata` reads (`title` / `description`). `queries.test.ts` guards the GROQ
 * projection, but nothing else stops someone re-adding a `brandColor` / `brandColorDark` /
 * `fontKey` field to the document — which is exactly the dead, code-unread, (two of them)
 * REQUIRED seed this slice removed. Re-adding one would force editors to fill a field no
 * code consumes again, and the query-layer test would stay green. Guard it here.
 */
type FieldDef = {name?: string; validation?: (rule: unknown) => unknown}

const fields = (siteSettings.fields ?? []) as ReadonlyArray<FieldDef>
const fieldNames = fields.map((f) => f.name)

describe('siteSettings schema — shell identity only (#142)', () => {
  it('is the siteSettings singleton document', () => {
    expect(siteSettings.name).toBe('siteSettings')
    expect(siteSettings.type).toBe('document')
  })

  it('keeps the identity fields generateMetadata reads', () => {
    expect(fieldNames).toContain('title')
    expect(fieldNames).toContain('description')
  })

  it('carries NO theming seeds — brand color + font live on each entry, not the shell', () => {
    for (const dead of ['brandColor', 'brandColorDark', 'fontKey']) {
      expect(fieldNames).not.toContain(dead)
    }
  })

  it('still requires title — the singleton can never publish nameless', () => {
    const title = fields.find((f) => f.name === 'title')
    expect(title, 'expected a title field').toBeDefined()
    // Run the inline validation with a chainable spy Rule and assert `.required()` fired.
    const called: string[] = []
    const rule: Record<string, () => unknown> = {
      required: () => {
        called.push('required')
        return rule
      },
      custom: () => rule,
    }
    title?.validation?.(rule)
    expect(called).toContain('required')
  })
})
