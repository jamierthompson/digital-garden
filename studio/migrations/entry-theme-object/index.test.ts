import {evaluate, parse} from 'groq-js'
import {at, set, unset} from 'sanity/migrate'
import {describe, expect, it} from 'vitest'

import migration from './index'

/**
 * The migration's `document` handler is a pure `(doc) => NodePatch[]`, so it is unit-testable
 * directly — no dataset, no API. `defineMigration` returns the definition unchanged (it only
 * type-checks), so `migration.migrate.document` IS the handler. These pin the reshape contract:
 * the `theme` object is built from the flat fields, optional keys are omitted when absent, the
 * three retired keys are unset, and a re-run (or a `now` with no color) is a no-op.
 */
type Handler = (doc: Record<string, unknown>) => unknown

const migrate = migration.migrate as {document: Handler}
const run = (doc: Record<string, unknown>): unknown => migrate.document(doc)

describe('entry-theme-object migration — document handler', () => {
  it('sets the full theme object and unsets all three flat keys', () => {
    const patches = run({
      _id: 'e1',
      _type: 'entry',
      themeColor: '#4f46e5',
      themeColorDark: '#312e81',
      fontKey: 'newsreader',
    })
    expect(patches).toEqual([
      {path: ['theme'], op: {type: 'set', value: {color: '#4f46e5', colorDark: '#312e81', bodyFont: 'newsreader'}}},
      {path: ['themeColor'], op: {type: 'unset'}},
      {path: ['themeColorDark'], op: {type: 'unset'}},
      {path: ['fontKey'], op: {type: 'unset'}},
    ])
  })

  it('omits absent optional keys — a color-only entry writes just theme.color', () => {
    const patches = run({_id: 'e2', _type: 'entry', themeColor: '#0ea5e9'}) as Array<{
      path: string[]
      op: {type: string; value?: unknown}
    }>
    expect(patches[0]).toEqual({path: ['theme'], op: {type: 'set', value: {color: '#0ea5e9'}}})
    // No `colorDark`/`bodyFont` keys at all (not even as undefined).
    expect(Object.keys((patches[0].op.value as object) ?? {})).toEqual(['color'])
  })

  it('carries only colorDark when fontKey is absent (and vice versa)', () => {
    const withDark = run({_id: 'e3', _type: 'entry', themeColor: '#111', themeColorDark: '#222'}) as Array<{
      op: {value: {color: string; colorDark?: string; bodyFont?: string}}
    }>
    expect(withDark[0].op.value).toEqual({color: '#111', colorDark: '#222'})

    const withFont = run({_id: 'e4', _type: 'entry', themeColor: '#111', fontKey: 'inter'}) as Array<{
      op: {value: {color: string; colorDark?: string; bodyFont?: string}}
    }>
    expect(withFont[0].op.value).toEqual({color: '#111', bodyFont: 'inter'})
  })

  it('is a no-op on an already-migrated doc (theme present) — idempotent re-run', () => {
    expect(run({_id: 'e5', _type: 'entry', themeColor: '#111', theme: {color: '#111'}})).toEqual([])
  })

  it('is a no-op on a now entry that carries no themeColor', () => {
    expect(run({_id: 'now1', _type: 'entry', kind: 'now'})).toEqual([])
  })

  it('is a no-op when themeColor is a non-string (defensive)', () => {
    expect(run({_id: 'e6', _type: 'entry', themeColor: null})).toEqual([])
    expect(run({_id: 'e7', _type: 'entry', themeColor: 123})).toEqual([])
  })

  // ── QA hardening (#249): malformed-input edges + filter/guard agreement ──

  it('emits patches whose shapes are the REAL sanity/migrate at/set/unset output (not a hand-rolled guess)', () => {
    // The happy-path test above pins the shape as literals; this proves those literals are what
    // the INSTALLED library actually produces, so a sanity/migrate upgrade that changes the
    // NodePatch shape fails here instead of silently drifting past the literal expectations.
    expect(
      run({_id: 'e8', _type: 'entry', themeColor: '#123456', themeColorDark: '#0a0a0a', fontKey: 'inter'}),
    ).toEqual([
      at('theme', set({color: '#123456', colorDark: '#0a0a0a', bodyFont: 'inter'})),
      at('themeColor', unset()),
      at('themeColorDark', unset()),
      at('fontKey', unset()),
    ])
  })

  it('carries an empty-string themeColor verbatim (behavior-preserving: "" flat → "" nested, engine-safe)', () => {
    const patches = run({_id: 'e9', _type: 'entry', themeColor: ''}) as Array<{op: {value?: unknown}}>
    expect(patches).toHaveLength(4)
    expect(patches[0].op.value).toEqual({color: ''})
  })

  it('drops NON-STRING optional fields from the theme instead of carrying garbage', () => {
    const patches = run({
      _id: 'e10',
      _type: 'entry',
      themeColor: '#111',
      themeColorDark: 42,
      fontKey: {nested: true},
    }) as Array<{op: {value?: unknown}}>
    expect(patches[0].op.value).toEqual({color: '#111'})
    // The garbage flat fields are still unset — the doc comes out clean either way.
    expect(patches).toHaveLength(4)
  })

  it('is a no-op when theme is present but a non-object (hostile/corrupt doc — never overwrites blindly)', () => {
    expect(run({_id: 'e11', _type: 'entry', themeColor: '#111', theme: 'corrupt'})).toEqual([])
    expect(run({_id: 'e12', _type: 'entry', themeColor: '#111', theme: 0})).toEqual([])
  })

  it('MIGRATES a `theme: null` doc — the guard (`!= null`) agrees with the filter (`!defined(theme)`)', () => {
    // In GROQ, `defined(null)` is false, so `!defined(theme)` matches a doc whose `theme` is
    // explicitly null (reachable only via a raw API write) — the filter hands it to the handler,
    // and the aligned `!= null` guard migrates it rather than stranding it half-done. The two
    // agree exactly: filter INCLUDES ⇔ handler MIGRATES. The executed-filter proof is below.
    expect(run({_id: 'e13', _type: 'entry', themeColor: '#111', theme: null})).toEqual([
      {path: ['theme'], op: {type: 'set', value: {color: '#111'}}},
      {path: ['themeColor'], op: {type: 'unset'}},
      {path: ['themeColorDark'], op: {type: 'unset'}},
      {path: ['fontKey'], op: {type: 'unset'}},
    ])
  })
})

describe('entry-theme-object migration — the GROQ `filter` executed (agreement with the in-code guard)', () => {
  const FILTER_AS_QUERY = `*[${migration.filter}]._id`

  async function matchedIds(dataset: Array<Record<string, unknown>>): Promise<unknown> {
    return (await evaluate(parse(FILTER_AS_QUERY), {dataset})).get()
  }

  it('selects exactly the unmigrated themed docs: flat color present, no theme object yet', async () => {
    const ids = await matchedIds([
      {_id: 'themed', _type: 'entry', themeColor: '#111'},
      {_id: 'migrated', _type: 'entry', theme: {color: '#111'}},
      {_id: 'now', _type: 'entry', kind: 'now'},
      {_id: 'both', _type: 'entry', themeColor: '#111', theme: {color: '#111'}},
    ])
    expect(ids).toEqual(['themed'])
  })

  it('a re-run over an already-migrated dataset matches NOTHING — idempotency at the query layer', async () => {
    const ids = await matchedIds([
      {_id: 'a', _type: 'entry', theme: {color: '#111', colorDark: '#222', bodyFont: 'inter'}},
      {_id: 'b', _type: 'entry', theme: {color: '#333'}},
      {_id: 'now', _type: 'entry', kind: 'now'},
    ])
    expect(ids).toEqual([])
  })

  it('INCLUDES a `theme: null` doc, which the aligned handler then migrates (filter ⇔ guard)', async () => {
    // `defined(null)` is false in GROQ, so this doc passes the filter; the aligned `!= null`
    // guard then migrates it (see the MIGRATES test above). Filter and guard agree exactly —
    // no doc is selected-but-refused.
    const ids = await matchedIds([
      {_id: 'null-theme', _type: 'entry', themeColor: '#111', theme: null},
    ])
    expect(ids).toEqual(['null-theme'])
  })
})
