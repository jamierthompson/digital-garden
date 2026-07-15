import {describe, expect, it} from 'vitest'

import {siteSettings} from './siteSettings'

/**
 * Pins the `siteSettings` contract at the SCHEMA layer under the site-wide engine-theming
 * model (#166 / #173 / #253).
 *
 * Three concerns live here now:
 *   • Shell identity — `title` (required) + `description`, read by `generateMetadata`.
 *   • The site default theme — `theme { color, colorDark }`, the ONE required seed the whole
 *     site falls back to. `color` is required and engine-validated; `colorDark` is an optional
 *     engine-validated dark override.
 *   • `pageThemes` — an OPTIONAL, engine-validated theme seed override per site-owned page
 *     (`home`/`browse`/`about`/`now`/`system`); an empty override inherits the site default.
 *
 * The guard: the default `theme.color` must stay required (drop it and an override-less page
 * renders unseeded — the engine fallback is a safety net, not the authored default), the page
 * seeds must stay engine-validated strings (`isThemeColorString`, not a color-picker), and the
 * five-page override set must stay closed.
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

describe('siteSettings schema — identity + site default theme + per-page overrides (#166/#253)', () => {
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

  it('carries a required site default theme object — the one seed everything falls back to', () => {
    const theme = fields.find((f) => f.name === 'theme')
    expect(theme, 'expected a theme field').toBeDefined()
    expect(theme?.type).toBe('object')
    expect(calledRules(theme)).toContain('required')
  })

  it('the default theme is the entry theme-seed shape — color + colorDark, nothing else', () => {
    const theme = fields.find((f) => f.name === 'theme')
    const names = (theme?.fields ?? []).map((f) => f.name)
    expect([...names].sort()).toEqual(['color', 'colorDark'])
  })

  it('requires and engine-validates the default color; colorDark stays an optional engine-validated override', () => {
    const theme = fields.find((f) => f.name === 'theme')
    const color = theme?.fields?.find((f) => f.name === 'color')
    const colorDark = theme?.fields?.find((f) => f.name === 'colorDark')
    expect(color?.type).toBe('string')
    expect(calledRules(color)).toContain('required')
    expect(calledRules(color)).toContain('custom')
    expect(colorDark?.type).toBe('string')
    expect(calledRules(colorDark)).not.toContain('required')
    expect(calledRules(colorDark)).toContain('custom')
  })

  it('carries the pageThemes override object — no longer required (#253)', () => {
    const pageThemes = fields.find((f) => f.name === 'pageThemes')
    expect(pageThemes, 'expected a pageThemes field').toBeDefined()
    expect(pageThemes?.type).toBe('object')
    expect(calledRules(pageThemes)).not.toContain('required')
  })

  it('exposes exactly the five site-owned page seeds', () => {
    const pageThemes = fields.find((f) => f.name === 'pageThemes')
    const seedNames = (pageThemes?.fields ?? []).map((f) => f.name)
    expect([...seedNames].sort()).toEqual(['about', 'browse', 'home', 'now', 'system'])
  })

  it('every page seed is an OPTIONAL engine-validated string — empty inherits the default, unparseable never publishes', () => {
    const pageThemes = fields.find((f) => f.name === 'pageThemes')
    expect(pageThemes?.fields?.length).toBeGreaterThan(0)
    for (const seed of pageThemes?.fields ?? []) {
      expect(seed.type, `${seed.name} should be a plain string, not a color-picker`).toBe('string')
      const called = calledRules(seed)
      expect(called, `${seed.name} must not be required — it is an override`).not.toContain(
        'required',
      )
      // `.custom(isThemeColorString)` is the engine-backed parse guard.
      expect(called, `${seed.name} must run the engine validator`).toContain('custom')
    }
  })
})
