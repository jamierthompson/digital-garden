import {describe, expect, it} from 'vitest'

import {figure} from '../objects/figure'
import {slot} from '../objects/slot'
import {video} from '../objects/video'
import {LANES, laneField} from './lane'

/**
 * QA — the shared lane field is the Studio half of the content-grid lane contract
 * (src/lib/lanes.ts mirrors the value set). Pins the field's shape AND that every media/slot
 * block actually attaches it — a block missing the field silently loses its authored lane
 * and every instance collapses to the code default.
 */
type FieldDef = {name?: string; type?: string; initialValue?: unknown; options?: unknown}
type ObjectDef = {fields?: ReadonlyArray<FieldDef>}

describe('the shared lane field', () => {
  const field = laneField()

  it('is an optional string field named lane, defaulting to wide', () => {
    expect(field.name).toBe('lane')
    expect(field.type).toBe('string')
    expect(field.initialValue).toBe('wide')
    // No validation of any kind — the app sanitizes unknown values to `wide`, so the list
    // can grow without breaking older documents.
    expect(field.validation).toBeUndefined()
  })

  it('offers exactly the lanes the app knows — wide / full / prose', () => {
    expect(LANES.map((l) => l.value).toSorted()).toEqual(['full', 'prose', 'wide'])
  })

  it.each([
    ['figure', figure],
    ['video', video],
    ['slot', slot],
  ])('the %s block attaches the lane field', (_name, type) => {
    const fields = ((type as ObjectDef).fields ?? []).map((f) => f.name)
    expect(fields).toContain('lane')
  })
})
