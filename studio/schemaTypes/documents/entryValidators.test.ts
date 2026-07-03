import {describe, expect, it} from 'vitest'

import {requiredForNonSketchProject, requiredForProject} from './entryValidators'

// The validators only read `context.document.{kind,stage}`; build a minimal context and
// cast to the real parameter type (derived from the function itself, so no `sanity` type
// import is needed and the test carries no Studio runtime dependency).
type Ctx = Parameters<typeof requiredForProject>[1]
const ctx = (document: unknown): Ctx => ({document}) as unknown as Ctx

describe('requiredForProject — brandColor: required for EVERY project', () => {
  it('is required for a project with no value (any stage)', () => {
    expect(requiredForProject(undefined, ctx({kind: 'project', stage: 'sketch'}))).toMatch(/Required/)
    expect(requiredForProject('', ctx({kind: 'project', stage: 'shipped'}))).toMatch(/Required/)
  })

  it('passes for a project that has a value, sketch included', () => {
    expect(requiredForProject('#4f46e5', ctx({kind: 'project', stage: 'sketch'}))).toBe(true)
    expect(requiredForProject('oklch(0.6 0.1 200)', ctx({kind: 'project', stage: 'prototype'}))).toBe(true)
  })

  it('is never required for a note/essay/now, value or not', () => {
    for (const kind of ['note', 'essay', 'now']) {
      expect(requiredForProject(undefined, ctx({kind}))).toBe(true)
    }
  })

  it('passes when the document is missing (no kind to read)', () => {
    expect(requiredForProject(undefined, ctx(undefined))).toBe(true)
  })
})

describe('requiredForNonSketchProject — componentKey/fontKey: required only PAST sketch', () => {
  it('is NOT required for a sketch-stage project — the relaxation, value or not', () => {
    expect(requiredForNonSketchProject(undefined, ctx({kind: 'project', stage: 'sketch'}))).toBe(true)
    expect(requiredForNonSketchProject('', ctx({kind: 'project', stage: 'sketch'}))).toBe(true)
  })

  it.each(['prototype', 'shipped'])('is required for a %s project with no value', (stage) => {
    expect(requiredForNonSketchProject(undefined, ctx({kind: 'project', stage}))).toMatch(
      /past the sketch stage/,
    )
  })

  it('is required for a project whose stage is missing (undefined !== "sketch")', () => {
    expect(requiredForNonSketchProject(undefined, ctx({kind: 'project'}))).toMatch(
      /past the sketch stage/,
    )
  })

  it('passes for a non-sketch project that has a value', () => {
    expect(requiredForNonSketchProject('palette-studio', ctx({kind: 'project', stage: 'shipped'}))).toBe(
      true,
    )
  })

  it('is never required for a note/essay/now, whatever the stage', () => {
    for (const kind of ['note', 'essay', 'now']) {
      expect(requiredForNonSketchProject(undefined, ctx({kind, stage: 'prototype'}))).toBe(true)
    }
  })

  it('passes when the document is missing', () => {
    expect(requiredForNonSketchProject(undefined, ctx(undefined))).toBe(true)
  })
})
