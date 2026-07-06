import {describe, expect, it} from 'vitest'

import {
  forbiddenForNow,
  requiredForNonSketchProject,
  requiredForThemedKind,
} from './entryValidators'

// The validators only read `context.document.{kind,stage}`; build a minimal context and
// cast to the real parameter type (derived from the function itself, so no `sanity` type
// import is needed and the test carries no Studio runtime dependency).
type Ctx = Parameters<typeof requiredForThemedKind>[1]
const ctx = (document: unknown): Ctx => ({document}) as unknown as Ctx

// `componentKey` / `fontKey` are CAPABILITY fields: required only on a non-sketch `project`
// (the floor `requiredForNonSketchProject` enforces), but honored downstream for any kind except
// `now`. So the contract has two halves per kind — the required floor AND that a value set on an
// optional kind is accepted, never rejected. Both halves are pinned below.
const OPTIONAL_KEY_KINDS = ['note', 'essay', 'now'] as const

// The three themed kinds that MUST carry a brandColor under #166 (every page derives its theme
// from an authored seed). `now` is the sole exempt kind (chrome + prose — it inherits /now).
const THEMED_KINDS = ['note', 'essay', 'project'] as const

describe('requiredForThemedKind — brandColor: required for note/essay/project (#166)', () => {
  it('is required for every themed kind with no value (any stage)', () => {
    for (const kind of THEMED_KINDS) {
      expect(requiredForThemedKind(undefined, ctx({kind, stage: 'sketch'}))).toMatch(/Required/)
      expect(requiredForThemedKind('', ctx({kind, stage: 'shipped'}))).toMatch(/Required/)
    }
  })

  it('passes for a themed kind that has a value, sketch included', () => {
    expect(requiredForThemedKind('#4f46e5', ctx({kind: 'project', stage: 'sketch'}))).toBe(true)
    expect(requiredForThemedKind('oklch(0.6 0.1 200)', ctx({kind: 'essay'}))).toBe(true)
    expect(requiredForThemedKind('#abc', ctx({kind: 'note'}))).toBe(true)
  })

  it('is never required for a now update — the floor exempts now (forbiddenForNow owns the ban)', () => {
    // requiredForThemedKind is ONLY the required floor; it never fires for now, whether the value
    // is absent or (irrelevantly to this validator) present. The now PROHIBITION lives in the
    // sibling `forbiddenForNow` — tested in its own block below — so the two concerns stay split.
    expect(requiredForThemedKind(undefined, ctx({kind: 'now'}))).toBe(true)
    expect(requiredForThemedKind(null, ctx({kind: 'now'}))).toBe(true)
    expect(requiredForThemedKind('#4f46e5', ctx({kind: 'now'}))).toBe(true)
  })

  it('passes when the document is missing (no kind to read)', () => {
    expect(requiredForThemedKind(undefined, ctx(undefined))).toBe(true)
  })

  // --- QA hardening: cleared-field, unknown-kind, and half-created-draft edges ---

  it('treats a cleared field (null) as missing — required for a themed kind', () => {
    // Clearing a field in Studio can yield null (not just undefined); the required floor
    // must still fire, otherwise an editor can "empty" an essay's brandColor and ship it.
    expect(requiredForThemedKind(null, ctx({kind: 'essay'}))).toMatch(/Required/)
    expect(requiredForThemedKind(null, ctx({kind: 'project', stage: 'sketch'}))).toMatch(/Required/)
  })

  it('is NOT required for an unknown/future kind — the floor is an explicit allowlist, not "≠ now"', () => {
    // Deliberate: a not-yet-invented kind must OPT IN by joining THEMED_KINDS. A denylist
    // ("required unless now") would silently force a brandColor on every future kind the
    // instant it is added — this asserts we chose the conservative allowlist instead.
    expect(requiredForThemedKind(undefined, ctx({kind: 'bookmark'}))).toBe(true)
  })

  it('is NOT required for a draft whose kind is not yet chosen (document present, no kind)', () => {
    // A brand-new draft exists before the editor picks a kind; it must not throw a required
    // error on brandColor the instant it is created.
    expect(requiredForThemedKind(undefined, ctx({stage: 'prototype'}))).toBe(true)
    expect(requiredForThemedKind(undefined, ctx({}))).toBe(true)
  })

  it('does not throw or require on a non-string kind (defensive allowlist)', () => {
    // `kind` crosses the wire as `unknown`; a malformed doc (number/object/boolean) must
    // fail OPEN via the allowlist `includes`, never require a brandColor or throw.
    expect(requiredForThemedKind(undefined, ctx({kind: 123}))).toBe(true)
    expect(requiredForThemedKind(undefined, ctx({kind: {_type: 'x'}}))).toBe(true)
    expect(requiredForThemedKind(undefined, ctx({kind: true}))).toBe(true)
    expect(requiredForThemedKind(undefined, ctx({kind: null}))).toBe(true)
  })
})

describe('forbiddenForNow — a now entry cannot set its own color (#173)', () => {
  it('REJECTS a non-empty color on a now entry (the /now seed themes all now content)', () => {
    expect(forbiddenForNow('#4f46e5', ctx({kind: 'now'}))).toMatch(/set its own color/)
    expect(forbiddenForNow('oklch(0.6 0.1 200)', ctx({kind: 'now'}))).toMatch(/set its own color/)
  })

  it('allows an empty/absent color on a now entry — nothing to reject', () => {
    expect(forbiddenForNow('', ctx({kind: 'now'}))).toBe(true)
    expect(forbiddenForNow(undefined, ctx({kind: 'now'}))).toBe(true)
    expect(forbiddenForNow(null, ctx({kind: 'now'}))).toBe(true)
  })

  it('never touches a non-now kind — a themed (or unknown) entry sets its own color freely', () => {
    for (const kind of ['note', 'essay', 'project', 'bookmark']) {
      expect(forbiddenForNow('#4f46e5', ctx({kind}))).toBe(true)
    }
  })

  it('passes when the document/kind is missing (no kind to gate on)', () => {
    expect(forbiddenForNow('#4f46e5', ctx(undefined))).toBe(true)
    expect(forbiddenForNow('#4f46e5', ctx({}))).toBe(true)
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
    for (const kind of OPTIONAL_KEY_KINDS) {
      expect(requiredForNonSketchProject(undefined, ctx({kind, stage: 'prototype'}))).toBe(true)
    }
  })

  it('ACCEPTS a componentKey/fontKey set on a note/essay/now — honored, not rejected', () => {
    for (const kind of OPTIONAL_KEY_KINDS) {
      expect(requiredForNonSketchProject('palette-studio', ctx({kind, stage: 'prototype'}))).toBe(true)
    }
  })

  it('passes when the document is missing', () => {
    expect(requiredForNonSketchProject(undefined, ctx(undefined))).toBe(true)
  })

  // --- QA hardening: cleared-field, unknown-kind, and half-created-draft edges ---

  it('treats a cleared field (null) as missing on a non-sketch project', () => {
    expect(requiredForNonSketchProject(null, ctx({kind: 'project', stage: 'shipped'}))).toMatch(
      /past the sketch stage/,
    )
  })

  it('is NOT required for an unknown/future kind past sketch — floor is project-ONLY', () => {
    expect(requiredForNonSketchProject(undefined, ctx({kind: 'bookmark', stage: 'prototype'}))).toBe(
      true,
    )
  })

  it('is NOT required for a draft whose kind is not yet chosen, whatever the stage', () => {
    expect(requiredForNonSketchProject(undefined, ctx({stage: 'prototype'}))).toBe(true)
    expect(requiredForNonSketchProject(undefined, ctx({}))).toBe(true)
  })
})
