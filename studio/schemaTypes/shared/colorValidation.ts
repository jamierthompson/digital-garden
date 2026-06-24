/**
 * Author-time `brandColor` validation — layer 2 of D9's three-layer defence,
 * now backed by the engine's *own* color pipeline rather than a regex.
 *
 * This runs `@garden/oklch`'s `buildTokenSet` (parse → gamut-map → contrast-solve)
 * and accepts the value iff the engine did NOT fall back. So the author-time check
 * is exactly the render-time contract: if Studio accepts a `brandColor`, the engine
 * will theme with it — it won't silently collapse to the fallback palette at render
 * [D9]. A regex couldn't promise that (it passed shapes the engine can't parse and
 * rejected ones it can).
 *
 * The engine is shared via a workspace package precisely so the standalone Studio can
 * import it [D23] — the same parse path the app's `ProjectScope` and `cardSwatches`
 * run, so all three agree on what "valid" means. The engine never throws [D9], so this
 * never throws; layers 1 (engine fallback) and 3 (`unstable_catchError`) still backstop
 * any value that slips through (e.g. edited via the API, not the Studio UI).
 */
import {buildTokenSet} from '@garden/oklch'

export function isBrandColorString(value: string | undefined): true | string {
  // Empty is allowed here — pair with `.required()` where the field is mandatory.
  if (!value) return true
  if (!buildTokenSet(value).meta.isFallback) return true
  return 'The theming engine can’t parse this color. Use a hex color (e.g. #4f46e5), an oklch() value (e.g. oklch(0.62 0.19 256)), or rgb().'
}
