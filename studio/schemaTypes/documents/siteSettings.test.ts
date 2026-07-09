import {describe, expect, it} from 'vitest'

import {siteSettings} from './siteSettings'

/**
 * Pins the `siteSettings` contract at the SCHEMA layer under the site-wide engine-theming
 * model (#166 / #173).
 *
 * Two concerns live here now:
 *   • Shell identity — `title` (required) + `description`, read by `generateMetadata`.
 *   • `pageThemes` — one authored, engine-validated theme seed per site-owned page
 *     (`home`/`browse`/`about`/`now`/`system`). This REPLACES the old #142 stance that the
 *     shell carried no theming fields: under #166 every page derives its theme from a seed,
 *     and the site-owned pages (which have no backing `entry`) seed from here.
 *
 * The guard: `pageThemes` must exist as a required object whose five page seeds are each
 * required and validated by the engine (`isThemeColorString`), not a color-picker. A regressed
 * projection (`queries.test.ts`) or a dropped seed would otherwise render a page unseeded.
 */
type Rule = {required: (...a: unknown[]) => Rule; custom: (...a: unknown[]) => Rule}
type FieldDef = {
  name?: string
  type?: string
  fields?: ReadonlyArray<FieldDef>
  validation?: (rule: Rule) => unknown
}

const fields = (siteSettings.fields ?? []) as ReadonlyArray<FieldDef>
const fieldNames = fields.map((f) => f.name)

// Drive a field's inline validation with a chainable spy Rule and record which rule methods
// fired — so a test can assert `.required()` / `.custom()` without a Studio runtime.
function calledRules(field: FieldDef | undefined): string[] {
  const called: string[] = []
  const rule: Rule = {
    required: () => {
      called.push('required')
      return rule
    },
    custom: () => {
      called.push('custom')
      return rule
    },
  }
  field?.validation?.(rule)
  return called
}

describe('siteSettings schema — identity + per-page theme seeds (#166)', () => {
  it('is the siteSettings singleton document', () => {
    expect(siteSettings.name).toBe('siteSettings')
    expect(siteSettings.type).toBe('document')
  })

  it('keeps the identity fields generateMetadata reads', () => {
    expect(fieldNames).toContain('title')
    expect(fieldNames).toContain('description')
  })

  it('still requires title — the singleton can never publish nameless', () => {
    const title = fields.find((f) => f.name === 'title')
    expect(title, 'expected a title field').toBeDefined()
    expect(calledRules(title)).toContain('required')
  })

  it('carries a required pageThemes object (the shell is engine-seeded, not monochromatic)', () => {
    const pageThemes = fields.find((f) => f.name === 'pageThemes')
    expect(pageThemes, 'expected a pageThemes field').toBeDefined()
    expect(pageThemes?.type).toBe('object')
    expect(calledRules(pageThemes)).toContain('required')
  })

  it('exposes exactly the five site-owned page seeds', () => {
    const pageThemes = fields.find((f) => f.name === 'pageThemes')
    const seedNames = (pageThemes?.fields ?? []).map((f) => f.name)
    expect([...seedNames].sort()).toEqual(['about', 'browse', 'home', 'now', 'system'])
  })

  it('requires and engine-validates every page seed — none may publish empty or unparseable', () => {
    const pageThemes = fields.find((f) => f.name === 'pageThemes')
    for (const seed of pageThemes?.fields ?? []) {
      expect(seed.type, `${seed.name} should be a plain string, not a color-picker`).toBe('string')
      const called = calledRules(seed)
      expect(called, `${seed.name} must be required`).toContain('required')
      // `.custom(isThemeColorString)` is the engine-backed parse guard.
      expect(called, `${seed.name} must run the engine validator`).toContain('custom')
    }
  })
})
