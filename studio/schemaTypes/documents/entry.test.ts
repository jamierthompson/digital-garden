import {ConcreteRuleClass} from 'sanity'
import {describe, expect, it} from 'vitest'

import {isThemeColorString} from '../shared/colorValidation'
import {entry} from './entry'
import {forbiddenForNow} from './entryValidators'

/**
 * Asserts the `entry` schema's required fields declare `rule.required()`. `required()` is a
 * built-in chainable with no standalone function to import, so each test drives a field's inline
 * `validation` with a spy Rule (`calledRules`) that records which rule methods fire — and, for
 * `body`'s rule, captures the `.custom()` callback so its behavior is asserted directly
 * (required for every kind, with `required()`'s empty-array semantics).
 */
type CustomValidator = (value: unknown, context: {document?: {kind?: string}}) => unknown
type Rule = {required: (...a: unknown[]) => Rule; custom: (...a: unknown[]) => Rule}
type FieldDef = {
  name?: string
  type?: string
  hidden?: (context: {document?: {kind?: string}}) => boolean
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

// Capture the `.custom()` callback a field's validation registers, so its behavior can be
// asserted directly (no Studio runtime).
function customValidator(f: FieldDef | undefined): CustomValidator | undefined {
  let captured: CustomValidator | undefined
  const rule: Rule = {
    required: () => rule,
    custom: (fn: unknown) => {
      captured = fn as CustomValidator
      return rule
    },
  }
  f?.validation?.(rule)
  return captured
}

describe('entry schema — required floors (#217)', () => {
  it('is the entry document', () => {
    expect(entry.name).toBe('entry')
    expect(entry.type).toBe('document')
  })

  it('requires body for EVERY kind — a body-less entry of any kind cannot publish', () => {
    const body = field('body')
    expect(body, 'expected a body field').toBeDefined()
    expect(body?.type).toBe('portableText')
    const validate = customValidator(body)
    expect(validate, 'expected the body-present custom rule').toBeDefined()
    for (const kind of ['note', 'essay', 'demo', 'now']) {
      expect(validate?.(undefined, {document: {kind}}), `${kind} without a body`).not.toBe(true)
      expect(validate?.([{_type: 'block'}], {document: {kind}}), `${kind} with a body`).toBe(true)
    }
  })

  it('never hides the body field — every kind renders the same prose article', () => {
    const body = field('body')
    expect(body?.hidden, 'body must not be kind-hidden').toBeUndefined()
  })

  it('keeps the other unconditional required floors (title/kind/slug)', () => {
    expect(calledRules(field('title'))).toContain('required')
    expect(calledRules(field('kind'))).toContain('required')
    expect(calledRules(field('slug'))).toContain('required')
  })

  it('still requires a body when the kind itself is absent (API-path import without kind)', () => {
    const validate = customValidator(field('body'))
    expect(validate?.(undefined, {document: {}})).not.toBe(true)
    expect(validate?.(undefined, {})).not.toBe(true)
  })

  // The custom rule must match `rule.required()`'s array semantics: Sanity's own required()
  // treats an EMPTY ARRAY as missing. An entry whose Portable Text body was emptied (all
  // blocks deleted, or an API write of `[]`) must not publish a blank article.
  it('rejects an EMPTY-ARRAY body for every kind — [] is a blank article, not a body', () => {
    const validate = customValidator(field('body'))
    for (const kind of ['note', 'essay', 'demo', 'now']) {
      expect(validate?.([], {document: {kind}}), `${kind} with body []`).not.toBe(true)
    }
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
    expect(theme?.hidden?.({document: {kind: 'demo'}})).toBe(false)
    expect(theme?.hidden?.({document: {}})).toBe(false)
  })

  it('attaches forbiddenForNow + isThemeColorString to theme.color — optional under #253, no required floor', () => {
    // An entry that authors no color wears the site default theme (`siteSettings.theme`), so
    // the old `requiredForThemedKind` floor is retired; the now-ban and the engine parse
    // guard are the only rules left.
    expect(customValidators(themeField('color'))).toEqual([forbiddenForNow, isThemeColorString])
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
    // componentKey mounts a module purely on PRESENCE for any kind, `now` included — no validation.
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
 * contract (a face absent inherits the site palette) and the #250 fix (a non-seedling demo
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

  it('componentKey invokes NEITHER required nor custom — a non-seedling demo publishes without it (#250 fix)', () => {
    // The deleted `requiredForNonSketchProject` used to force `componentKey` on a demo past
    // the first stage; its live symptom was a prose-only evergreen demo that could not publish. With the
    // floor gone, `componentKey` must carry no validation at all — mount-on-presence only.
    expect(calledRules(field('componentKey'))).toEqual([])
  })

  it('theme.color KEEPS its two custom rules and gains no required floor — optional means optional (#253)', () => {
    // Guard the blast radius both ways: the now-ban and the engine parse guard must survive,
    // and no `rule.required()` may sneak back in — an entry without a color is a valid
    // authored state that wears the site default theme.
    expect(calledRules(themeField('color'))).toEqual(['custom', 'custom'])
  })
})

/**
 * QA (#312): the kind value rename (`project` → `demo`) and the `blurb` → `summary` field
 * rename. Pins that the schema's option list, its `initialValue`, and the field roster all
 * moved together — a partial rename (e.g. `initialValue: 'demo'` while the list still offers
 * `project`, or vice versa) would initialize every new entry to an ILLEGAL kind value that
 * the radio input cannot even display.
 */
type KindField = FieldDef & {
  options?: {list?: ReadonlyArray<{title?: string; value?: string}>}
  initialValue?: unknown
}

describe('entry schema — kind list + initialValue move together (#312 rename)', () => {
  const kind = field('kind') as KindField | undefined
  const values = kind?.options?.list?.map((o) => o.value)

  it('offers exactly note / essay / demo / now — the retired `project` value is gone', () => {
    expect(values).toEqual(['note', 'essay', 'demo', 'now'])
  })

  it('initialValue is `demo` AND a member of the declared option list — never an orphaned value', () => {
    expect(kind?.initialValue).toBe('demo')
    expect(values).toContain(kind?.initialValue)
  })

  it('carries a summary field and no legacy blurb field', () => {
    const summary = field('summary')
    expect(summary, 'expected a summary field').toBeDefined()
    expect(summary?.type).toBe('text')
    expect(fields.map((f) => f.name)).not.toContain('blurb')
  })
})

/**
 * QA (stage-vocabulary rename): the stage values renamed `sketch`/`prototype`/`shipped` →
 * `seedling`/`budding`/`evergreen` and `iterated` → `tended`. Same bug class as the #312 kind
 * rename above: a partial rename (an `initialValue` orphaned from its option list) would
 * initialize every new entry to an ILLEGAL stage the radio input cannot display — and the
 * stage/tended contract (hidden + exempt for a `now`, required for every other kind; tended a
 * plain optional date) had no pin at all before this rename.
 */
describe('entry schema — stage list + initialValue move together (stage-vocabulary rename)', () => {
  const stage = field('stage') as KindField | undefined
  const values = stage?.options?.list?.map((o) => o.value)

  it('offers exactly seedling / budding / evergreen — the retired sketch/prototype/shipped values are gone', () => {
    expect(values).toEqual(['seedling', 'budding', 'evergreen'])
  })

  it('initialValue is `seedling` AND a member of the declared option list — never an orphaned value', () => {
    expect(stage?.initialValue).toBe('seedling')
    expect(values).toContain(stage?.initialValue)
  })

  it('hides stage for a `now` update, and only for `now`', () => {
    expect(stage?.hidden?.({document: {kind: 'now'}})).toBe(true)
    expect(stage?.hidden?.({document: {kind: 'demo'}})).toBe(false)
    expect(stage?.hidden?.({document: {}})).toBe(false)
  })

  it('requires a stage for every kind EXCEPT `now` — the rename kept the kind-gated floor', () => {
    const validate = customValidator(field('stage'))
    expect(validate, 'expected the kind-gated custom rule').toBeDefined()
    for (const kind of ['note', 'essay', 'demo']) {
      expect(validate?.(undefined, {document: {kind}}), `${kind} without a stage`).not.toBe(true)
      expect(validate?.('seedling', {document: {kind}}), `${kind} with a stage`).toBe(true)
    }
    expect(validate?.(undefined, {document: {kind: 'now'}}), 'now without a stage').toBe(true)
  })

  it('still requires a stage when the kind itself is absent (API-path import without kind)', () => {
    const validate = customValidator(field('stage'))
    expect(validate?.(undefined, {document: {}})).not.toBe(true)
    expect(validate?.(undefined, {})).not.toBe(true)
  })

  it('renamed the date field to `tended` titled "Last tended" — a plain optional date, no floor', () => {
    const tended = field('tended') as (FieldDef & {title?: string}) | undefined
    expect(tended, 'expected a tended field').toBeDefined()
    expect(tended?.type).toBe('date')
    expect(tended?.title).toBe('Last tended')
    expect(calledRules(tended)).toEqual([])
    expect(fields.map((f) => f.name)).not.toContain('iterated')
  })
})

/**
 * QA (#312): the summary caps EXECUTED against the real installed Sanity Rule runtime —
 * the stated contract is a 280-char WARNING (card-sized nudge, still publishable) and a
 * 300-char ERROR (hard cap, blocks publish). A spy-Rule test cannot see levels; only
 * running the field's actual `validation` chain through `ConcreteRuleClass.validate`
 * proves which tier fires at which length.
 */
describe('entry schema — summary caps: 280 warns, 300 errors (#312)', () => {
  interface Marker {
    level: string
    message: string
  }
  interface ExecutableRule {
    validate(value: unknown, context: unknown): Promise<Marker[]>
  }

  async function summaryMarkers(value: string): Promise<Marker[]> {
    const validation = field('summary')?.validation as
      | ((rule: unknown) => unknown)
      | undefined
    const returned = validation?.(new ConcreteRuleClass().type('String'))
    // Sanity accepts Rule | Rule[] from `validation` — a two-tier warn+error contract is
    // expressed as an ARRAY of rules (one per level), so normalize both shapes.
    const rules = (Array.isArray(returned) ? returned : [returned]) as ExecutableRule[]
    const i18n = {t: (key: string) => key}
    const markers: Marker[] = []
    for (const rule of rules) markers.push(...(await rule.validate(value, {i18n})))
    return markers
  }

  it('a summary AT the 280 cap publishes clean — no marker of any level', async () => {
    expect(await summaryMarkers('x'.repeat(280))).toEqual([])
  })

  it('a 281–300-char summary WARNS (card-sized nudge) and must NOT block publish', async () => {
    const markers = await summaryMarkers('x'.repeat(290))
    // The stated soft tier: a warning fires past 280…
    expect(markers.some((m) => m.level === 'warning')).toBe(true)
    // …and no error-level marker may fire below the 300 hard cap — an error here blocks
    // publish 20 characters early, with the hard-cap message on a summary that is legal.
    expect(markers.some((m) => m.level === 'error')).toBe(false)
  })

  it('a 301+-char summary ERRORS on the 300 hard cap', async () => {
    const markers = await summaryMarkers('x'.repeat(310))
    expect(markers.some((m) => m.level === 'error' && /300/.test(m.message))).toBe(true)
  })
})
