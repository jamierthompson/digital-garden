import {describe, expect, it} from 'vitest'

import {entry} from './entry'

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
