import {describe, expect, it} from 'vitest'

import {forbiddenForNow} from './entryValidators'

// The validator only reads `context.document.kind`; build a minimal context and cast to the real
// parameter type (derived from the function itself, so no `sanity` type import is needed and the
// test carries no Studio runtime dependency).
type Ctx = Parameters<typeof forbiddenForNow>[1]
const ctx = (document: unknown): Ctx => ({document}) as unknown as Ctx

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
    for (const kind of ['note', 'essay', 'demo', 'bookmark']) {
      expect(forbiddenForNow('#4f46e5', ctx({kind}))).toBe(true)
    }
  })

  it('leaves an ABSENT color alone on a themed kind — optional under #253, the site default covers it', () => {
    // The old `requiredForThemedKind` floor is retired: an entry that authors no color wears
    // the site default theme (`siteSettings.theme`), so absence is a valid authored state.
    for (const kind of ['note', 'essay', 'demo']) {
      expect(forbiddenForNow(undefined, ctx({kind, stage: 'sketch'}))).toBe(true)
      expect(forbiddenForNow(null, ctx({kind}))).toBe(true)
    }
  })

  it('treats the RETIRED legacy kind `project` like any unknown kind — no ban outside `now` (#312)', () => {
    expect(forbiddenForNow('#4f46e5', ctx({kind: 'project'}))).toBe(true)
  })

  it('passes when the document/kind is missing (no kind to gate on)', () => {
    expect(forbiddenForNow('#4f46e5', ctx(undefined))).toBe(true)
    expect(forbiddenForNow('#4f46e5', ctx({}))).toBe(true)
  })

  it('does not throw or ban on a non-string kind (defensive gate)', () => {
    // `kind` crosses the wire as `unknown`; a malformed doc (number/object/boolean) must
    // fail OPEN — only the literal "now" triggers the ban.
    expect(forbiddenForNow('#4f46e5', ctx({kind: 123}))).toBe(true)
    expect(forbiddenForNow('#4f46e5', ctx({kind: {_type: 'x'}}))).toBe(true)
    expect(forbiddenForNow('#4f46e5', ctx({kind: true}))).toBe(true)
    expect(forbiddenForNow('#4f46e5', ctx({kind: null}))).toBe(true)
  })
})
