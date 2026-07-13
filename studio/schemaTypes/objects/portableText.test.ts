import {describe, expect, it} from 'vitest'

import {portableText} from './portableText'

/**
 * Pins the shared `entry.body` block palette (#250) at the SCHEMA layer.
 *
 * Two guards:
 *   • The array `of` carries the one shared palette — prose (`block`) plus the four typed blocks
 *     `figure` · `video` · `slot` · `quote`. `kind` places an entry; it does not restrict this.
 *   • The prose `block` declares an EXPLICIT `styles` list (Normal · H2 · H3) — which, per
 *     @sanity/schema, replaces the Sanity defaults. That drops the inline `blockquote` style (so
 *     the typed `quote` block is the one quotation mechanism) and drops H1 (the body sits under
 *     the page's `<h1>` entry title, so a body H1 breaks the heading outline — WCAG 1.3.1).
 *     `lists`/`marks` stay unspecified so the defaults (lists, decorators, link annotation) hold.
 */
type ArrayMember = {type?: string; styles?: ReadonlyArray<{value?: string}>}

const members = (portableText.of ?? []) as ReadonlyArray<ArrayMember>
const memberTypes = members.map((m) => m.type)
const block = members.find((m) => m.type === 'block')
const styleValues = (block?.styles ?? []).map((s) => s.value)

describe('portableText schema — the shared entry-body palette', () => {
  it('carries prose plus the four typed blocks', () => {
    expect(memberTypes).toEqual(['block', 'figure', 'video', 'slot', 'quote'])
  })

  it('declares exactly Normal/H2/H3 prose styles', () => {
    expect([...styleValues].sort()).toEqual(['h2', 'h3', 'normal'])
  })

  it('drops the inline blockquote style — the quote block is the one quotation mechanism', () => {
    expect(styleValues).not.toContain('blockquote')
  })

  it('drops the body H1 style — the entry title owns the page h1', () => {
    expect(styleValues).not.toContain('h1')
  })

  it('leaves lists and marks unspecified so the Sanity defaults (incl. the link annotation) hold', () => {
    expect(block).not.toHaveProperty('lists')
    expect(block).not.toHaveProperty('marks')
  })
})
