/**
 * Resolves the front-end origin the Presentation tool loads in its iframe
 * (`presentationTool({previewUrl: {initial}})` in sanity.config.ts).
 *
 * Local development falls back to the Next.js dev server, but a DEPLOYED Studio
 * MUST be given a valid origin explicitly: a deployed Studio whose Presentation
 * iframe points at `http://localhost:3000` (or any origin that can't connect)
 * breaks the Visual Editing handshake — `Unable to connect to visual editing`
 * (#193). Rather than silently ship such a URL in a production build, we throw.
 *
 * The guard is SYMMETRIC — it rejects both failure modes:
 *   • unset → throw (would otherwise fall back to unreachable localhost);
 *   • set-but-malformed (no scheme, whitespace in the host, non-http(s)) → throw.
 * A valid value is normalized to its bare `origin`, which enforces the
 * `.env.example` contract ("absolute origin, no trailing slash") for free: a
 * trailing slash, redundant path, or query is canonicalized away. (Dropping a
 * path/query is deliberate — `previewUrl.initial` is an ORIGIN, the site root the
 * iframe loads; the enable/disable routes are absolute paths resolved against it.)
 *
 * Why the `NODE_ENV === 'production'` guard is correct: Sanity's `build` and
 * `deploy` commands run in `production` mode, while every other command
 * (`sanity dev`, TypeGen's `schema extract`) runs in `development`
 * (https://www.sanity.io/docs/studio/environment-variables → "Modes"). And
 * `SANITY_STUDIO_*` vars are *statically replaced* at build time, so an unset var
 * surfaces here as `undefined` and the guard fires as a hard, un-missable
 * build/load failure — never a silent bad fallback in production. Development
 * stays lenient (a malformed value is surfaced raw so local preview fails
 * visibly, and the production build is the hard gate before anything ships).
 *
 * Read the env via the FULL static member expressions `process.env.X` at the call
 * site (see `previewUrl` below), never by passing `process.env` around: the Sanity
 * bundler only replaces the full `process.env.SANITY_STUDIO_*` form, and
 * `process.env` itself is `undefined` in a production bundle (same doc). This
 * module keeps the resolution logic pure so it stays unit-testable.
 */
const LOCAL_PREVIEW_URL = 'http://localhost:3000'

/**
 * Returns the bare `http(s)` origin of `value` (scheme + host + port, no trailing
 * slash), or `null` if it is not a valid absolute http(s) URL. Uses the WHATWG URL
 * parser: it throws on a missing scheme or an invalid host (e.g. internal
 * whitespace), and a non-`http(s)` scheme (e.g. `ftp:`) is rejected explicitly.
 */
function toHttpOrigin(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.origin
}

function requiredOriginError(received: string): Error {
  return new Error(
    `SANITY_STUDIO_PREVIEW_URL is required for a production Studio build and must be a valid ` +
      `absolute http(s) origin (received: ${received}). A deployed Studio must point its ` +
      `Presentation iframe at the deployed front-end origin ` +
      `(e.g. https://digital-garden-ten-mu.vercel.app — absolute, no trailing slash), otherwise ` +
      `Visual Editing loads localhost and cannot connect (#193). Set it before \`sanity deploy\`; ` +
      `see studio/.env.example.`,
  )
}

export function resolvePreviewUrl(opts: {configured?: string; nodeEnv?: string}): string {
  const isProduction = opts.nodeEnv === 'production'
  const configured = opts.configured?.trim()

  if (configured) {
    const origin = toHttpOrigin(configured)
    if (origin) return origin

    // Configured but malformed. Production must not ship a preview URL that can't
    // connect; development surfaces the raw value so the break is visible locally.
    if (isProduction) throw requiredOriginError(JSON.stringify(configured))
    return configured
  }

  if (isProduction) throw requiredOriginError('not set')

  return LOCAL_PREVIEW_URL
}

export const previewUrl = resolvePreviewUrl({
  configured: process.env.SANITY_STUDIO_PREVIEW_URL,
  nodeEnv: process.env.NODE_ENV,
})
