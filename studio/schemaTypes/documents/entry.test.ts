import {describe, expect, it} from 'vitest'

import {isThemeColorString} from '../shared/colorValidation'
import {entry} from './entry'
import {forbiddenForNow, requiredForThemedKind} from './entryValidators'

/**
 * Asserts the `entry` schema's required fields declare `rule.required()`. `required()` is a
 * built-in chainable with no standalone function to import, so each test drives a field's inline
 * `validation` with a spy Rule (`calledRules`) that records which rule methods fire. A future edit
 * that drops a required rule, or makes `body` conditional with a `.custom()` gate, fails here.
 */
type Rule = {required: (...a: unknown[]) => Rule; custom: (...a: unknown[]) => Rule}
type FieldDef = {
  name?: string
  type?: string
  validation?: (rule: Rule) => unknown
}

const fields = (entry.fields ?? []) as ReadonlyArray<FieldDef>
const field = (name: string): FieldDef | undefined => fields.find((f) => f.name === name)

// Drive a field's inline validation with a chainable spy Rule and record which rule methods
// fired — so a test can assert `.required()` / `.custom()` without a Studio runtime.
function calledRules(f: FieldDef | undefined): string[] {
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
  f?.validation?.(rule)
  return called
}

describe('entry schema — required floors (#217)', () => {
  it('is the entry document', () => {
    expect(entry.name).toBe('entry')
    expect(entry.type).toBe('document')
  })

  it('requires body — a body-less entry cannot publish (#217)', () => {
    const body = field('body')
    expect(body, 'expected a body field').toBeDefined()
    expect(body?.type).toBe('portableText')
    expect(calledRules(body)).toContain('required')
  })

  it('requires body unconditionally — exactly one required rule, no kind gate', () => {
    // Every kind (note/essay/project/now) carries a body, so body uses the built-in
    // `rule.required()` with no `.custom()` kind gate. A regression that made body conditional
    // would add a `custom` call or drop `required`.
    expect(calledRules(field('body'))).toEqual(['required'])
  })

  it('keeps the other unconditional required floors (title/kind/slug)', () => {
    expect(calledRules(field('title'))).toContain('required')
    expect(calledRules(field('kind'))).toContain('required')
    expect(calledRules(field('slug'))).toContain('required')
  })
})

/**
 * QA (#249): `entryValidators.test.ts` proves the validators BEHAVE correctly, but nothing
 * proved they are ATTACHED to the nested `theme` fields — a schema edit could detach
 * `forbiddenForNow` from `theme.color` and every test would stay green. Drive each field's
 * `validation` with a spy Rule that RECORDS the functions handed to `.custom()`, and assert
 * identity against the imported validators.
 */
type ThemeField = FieldDef & {
  fields?: ReadonlyArray<FieldDef>
  hidden?: (ctx: {document?: Record<string, unknown>}) => boolean
}

function customValidators(f: FieldDef | undefined): ReadonlyArray<unknown> {
  const collected: unknown[] = []
  const rule = {
    required: () => rule,
    custom: (fn: unknown) => {
      collected.push(fn)
      return rule
    },
  }
  f?.validation?.(rule as unknown as Rule)
  return collected
}

describe('entry schema — the theme object (#249)', () => {
  const theme = field('theme') as ThemeField | undefined
  const themeField = (name: string): FieldDef | undefined =>
    theme?.fields?.find((f) => f.name === name)

  it('declares theme as an object of exactly { color, colorDark, headingFont, bodyFont, monoFont }', () => {
    expect(theme, 'expected a theme field').toBeDefined()
    expect(theme?.type).toBe('object')
    expect(theme?.fields?.map((f) => f.name)).toEqual([
      'color',
      'colorDark',
      'headingFont',
      'bodyFont',
      'monoFont',
    ])
  })

  it('hides the whole theme object for a now update (and only for now)', () => {
    expect(theme?.hidden?.({document: {kind: 'now'}})).toBe(true)
    expect(theme?.hidden?.({document: {kind: 'project'}})).toBe(false)
    expect(theme?.hidden?.({document: {}})).toBe(false)
  })

  it('attaches requiredForThemedKind + forbiddenForNow + isThemeColorString to theme.color', () => {
    expect(customValidators(themeField('color'))).toEqual([
      requiredForThemedKind,
      forbiddenForNow,
      isThemeColorString,
    ])
  })

  it('attaches forbiddenForNow + isThemeColorString to theme.colorDark (optional, never required)', () => {
    expect(customValidators(themeField('colorDark'))).toEqual([
      forbiddenForNow,
      isThemeColorString,
    ])
  })

  it('declares the three font faces as optional string fields with no validation (#226)', () => {
    for (const face of ['headingFont', 'bodyFont', 'monoFont']) {
      const f = themeField(face)
      expect(f, `expected a theme.${face} field`).toBeDefined()
      expect(f?.type).toBe('string')
      // Each face is optional — an absent key inherits the site type palette — so it carries
      // no required floor and no custom validator.
      expect(customValidators(f)).toEqual([])
    }
  })

  it('keeps componentKey a TOP-LEVEL field (not part of the theme), optional and unvalidated', () => {
    const componentKey = field('componentKey')
    expect(componentKey, 'expected a top-level componentKey').toBeDefined()
    expect(componentKey?.type).toBe('string')
    // componentKey mounts a module purely on PRESENCE for any non-`now` kind — no validation.
    expect(customValidators(componentKey)).toEqual([])
  })

  it('carries no stray flat theming fields — themeColor / themeColorDark / fontKey are gone', () => {
    const names = fields.map((f) => f.name)
    expect(names).not.toContain('themeColor')
    expect(names).not.toContain('themeColorDark')
    expect(names).not.toContain('fontKey')
  })
})

/**
 * QA (#226): the sibling assertions above use `customValidators`, which records only the
 * functions handed to `.custom()` — it is BLIND to a built-in `rule.required()`. So
 * `customValidators(face).toEqual([])` would stay green if a regression re-imposed a required
 * FLOOR on a font face or `componentKey` via `rule.required()` (or re-attached the deleted
 * `requiredForNonSketchProject` as `.custom()` — that one the sibling catches, this one also
 * catches). These fields being TRULY optional — zero validation of ANY kind — is the whole #226
 * contract (a face absent inherits the site palette) and the #250 fix (a non-sketch project
 * publishes with no `componentKey`). `calledRules` records BOTH `required` and `custom`, so an
 * empty result is the tightest proof the field imposes no floor at all.
 */
describe('entry schema — the three faces + componentKey are truly unvalidated (#226/#250)', () => {
  const theme = field('theme') as ThemeField | undefined
  const themeField = (name: string): FieldDef | undefined =>
    theme?.fields?.find((f) => f.name === name)

  it.each(['headingFont', 'bodyFont', 'monoFont'])(
    'theme.%s invokes NEITHER required nor custom — no floor of any kind',
    (face) => {
      const f = themeField(face)
      expect(f, `expected a theme.${face} field`).toBeDefined()
      expect(calledRules(f)).toEqual([])
    },
  )

  it('componentKey invokes NEITHER required nor custom — a non-sketch project publishes without it (#250 fix)', () => {
    // The deleted `requiredForNonSketchProject` used to force `componentKey` on a project past
    // sketch; its live symptom was a prose-only shipped project that could not publish. With the
    // floor gone, `componentKey` must carry no validation at all — mount-on-presence only.
    expect(calledRules(field('componentKey'))).toEqual([])
  })

  it('theme.color KEEPS its floor — the deletion did not over-reach into the color rules', () => {
    // Guard the blast radius: removing the font/componentKey floor must NOT strip the color
    // required floor. `calledRules` here should still record the three custom color validators.
    expect(calledRules(themeField('color'))).toEqual(['custom', 'custom', 'custom'])
  })
})
