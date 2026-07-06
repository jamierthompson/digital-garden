import {describe, expect, it} from 'vitest'

import {resolvePreviewUrl} from './previewUrl'

/**
 * Guards the Presentation `previewUrl.initial` resolution (#193). The regression
 * these tests exist to prevent: a deployed Studio shipping a preview URL that
 * can't connect — either an unset var (silent `localhost:3000` fallback) or a
 * set-but-malformed origin — so Visual Editing never connects.
 *
 * The contract:
 *   • A valid configured origin always wins, normalized to its bare origin (scheme
 *     + host + port, no trailing slash / path / query).
 *   • No origin + development → the localhost dev-server fallback (local worked, keep it).
 *   • Production is STRICT and SYMMETRIC — unset OR malformed both THROW, rather
 *     than shipping a preview URL that can't connect.
 *   • Development is LENIENT — never throws; a malformed value is surfaced raw so
 *     the break is visible locally, and the production build is the hard gate.
 */
describe('resolvePreviewUrl', () => {
  it('returns the configured origin (normalized) when set', () => {
    expect(resolvePreviewUrl({configured: 'https://example.com', nodeEnv: 'development'})).toBe(
      'https://example.com',
    )
  })

  it('trims surrounding whitespace from the configured origin', () => {
    expect(resolvePreviewUrl({configured: '  https://example.com  ', nodeEnv: 'production'})).toBe(
      'https://example.com',
    )
  })

  it('prefers the configured origin even in a production build', () => {
    expect(
      resolvePreviewUrl({
        configured: 'https://digital-garden-ten-mu.vercel.app',
        nodeEnv: 'production',
      }),
    ).toBe('https://digital-garden-ten-mu.vercel.app')
  })

  it('falls back to the localhost dev server outside production', () => {
    expect(resolvePreviewUrl({configured: undefined, nodeEnv: 'development'})).toBe(
      'http://localhost:3000',
    )
  })

  it('falls back to localhost when NODE_ENV is unset (dev-safe default)', () => {
    expect(resolvePreviewUrl({configured: undefined, nodeEnv: undefined})).toBe(
      'http://localhost:3000',
    )
  })

  it('throws in a production build when no origin is configured', () => {
    expect(() => resolvePreviewUrl({configured: undefined, nodeEnv: 'production'})).toThrow(
      /SANITY_STUDIO_PREVIEW_URL is required/,
    )
  })

  it('throws in production when the configured origin is blank after trimming', () => {
    expect(() => resolvePreviewUrl({configured: '   ', nodeEnv: 'production'})).toThrow(
      /SANITY_STUDIO_PREVIEW_URL is required/,
    )
  })

  // ── Boundary / edge cases (QA, #193) — the original 7 skipped these. ──

  it('throws in production when the configured origin is an empty string', () => {
    expect(() => resolvePreviewUrl({configured: '', nodeEnv: 'production'})).toThrow(
      /SANITY_STUDIO_PREVIEW_URL is required/,
    )
  })

  it('throws in production when the configured origin is only a tab/newline', () => {
    expect(() => resolvePreviewUrl({configured: '\t\n', nodeEnv: 'production'})).toThrow(
      /SANITY_STUDIO_PREVIEW_URL is required/,
    )
  })

  it('falls back to localhost in development for an empty-string origin', () => {
    expect(resolvePreviewUrl({configured: '', nodeEnv: 'development'})).toBe(
      'http://localhost:3000',
    )
  })

  it('falls back to localhost in development for a whitespace-only origin', () => {
    expect(resolvePreviewUrl({configured: '   ', nodeEnv: 'development'})).toBe(
      'http://localhost:3000',
    )
  })

  it('does NOT throw under the Vitest test env (nodeEnv "test") — only "production" is the trip', () => {
    // Vitest sets NODE_ENV=test; the guard must be scoped to production alone, otherwise
    // the whole suite (and any `test`-mode tooling) would blow up on an unset var.
    expect(resolvePreviewUrl({configured: undefined, nodeEnv: 'test'})).toBe(
      'http://localhost:3000',
    )
  })

  it('is case-sensitive on nodeEnv: "Production"/"PRODUCTION" do NOT trip the guard', () => {
    // Pins the strict-equality contract. NODE_ENV is conventionally lowercase "production";
    // if a non-canonical casing ever reached a deploy, the guard would silently not fire.
    expect(resolvePreviewUrl({configured: undefined, nodeEnv: 'Production'})).toBe(
      'http://localhost:3000',
    )
    expect(resolvePreviewUrl({configured: undefined, nodeEnv: 'PRODUCTION'})).toBe(
      'http://localhost:3000',
    )
  })

  it('trims tabs and newlines around the configured origin', () => {
    expect(
      resolvePreviewUrl({configured: '\t https://example.com \n', nodeEnv: 'production'}),
    ).toBe('https://example.com')
  })

  it('throw message is actionable: names the var, the fix, and the #193 reference', () => {
    let message = ''
    try {
      resolvePreviewUrl({configured: undefined, nodeEnv: 'production'})
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }
    expect(message).toContain('SANITY_STUDIO_PREVIEW_URL')
    expect(message).toContain('sanity deploy')
    expect(message).toContain('#193')
  })

  /**
   * The symmetry the guard must hold: a set-but-broken origin is as unshippable as
   * an unset one. `.env.example` promises "absolute origin, no trailing slash" — the
   * resolver ENFORCES that (normalize to the bare origin, or throw), rather than
   * `.trim()`-ing and passing a broken value straight through to previewUrl.initial.
   */
  describe('malformed configured origin', () => {
    it('normalizes a trailing slash away (production)', () => {
      expect(resolvePreviewUrl({configured: 'https://example.com/', nodeEnv: 'production'})).toBe(
        'https://example.com',
      )
    })

    it('normalizes redundant trailing slashes away (production)', () => {
      expect(resolvePreviewUrl({configured: 'https://example.com///', nodeEnv: 'production'})).toBe(
        'https://example.com',
      )
    })

    it('canonicalizes a path/query down to the bare origin (production)', () => {
      expect(
        resolvePreviewUrl({configured: 'https://example.com/preview?foo=1', nodeEnv: 'production'}),
      ).toBe('https://example.com')
    })

    it('throws on internal whitespace in the host (production)', () => {
      expect(() =>
        resolvePreviewUrl({configured: 'https://exa mple.com', nodeEnv: 'production'}),
      ).toThrow(/must be a valid absolute http\(s\) origin/)
    })

    it('throws on a scheme-less origin (production)', () => {
      expect(() => resolvePreviewUrl({configured: 'example.com', nodeEnv: 'production'})).toThrow(
        /must be a valid absolute http\(s\) origin/,
      )
    })

    it('throws on a non-http(s) scheme (production)', () => {
      expect(() =>
        resolvePreviewUrl({configured: 'ftp://example.com', nodeEnv: 'production'}),
      ).toThrow(/must be a valid absolute http\(s\) origin/)
    })

    it('surfaces a malformed value raw in development (lenient, no throw)', () => {
      expect(resolvePreviewUrl({configured: 'not-a-url', nodeEnv: 'development'})).toBe('not-a-url')
    })
  })
})
