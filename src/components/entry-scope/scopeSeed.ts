// Pure, defensive resolution of an entry "scope seed" → the vetted slug + the brand font for
// its interactive slot.
//
// The slot's COLOR comes from the page's `<html>` theme (every route stamps its authored seed
// there and the slot inherits it), so the only per-slot override is the entry's font: this
// module resolves the `fontKey` through the roster (`resolveFontKey`) and hands `EntryScope`
// the face to mount + map onto `--font-face`.
//
// The defensive contract the stub established is preserved: `resolveScope` is TOTAL and NEVER
// throws. A bad/unknown `fontKey` collapses to the shell mono face via `resolveFontKey`'s
// `NotFound` branch, and the slug is vetted to `[a-z0-9-]` so a hostile slug can never inject
// into the `[data-entry="…"]` selector. Keeping resolution pure (no React, no I/O) is what lets
// us unit-test the never-throw guarantee directly in jsdom instead of fighting an async RSC.

import { resolveFontKey } from "@/lib/resolvers/fonts";
import type { FontFace } from "@/fonts/roster";

/** A resolved scope: the vetted slug it is keyed on + the brand font to mount. */
export interface ResolvedScope {
  /**
   * The selector key: the entry's slug, sanitized to `[a-z0-9-]` (never raw user input) so it is
   * **injection-safe** — it can't break out of `[data-entry="…"]`. UNIQUENESS per entry is
   * guaranteed upstream by the Sanity `slug` schema (charset `^[a-z0-9-]+$` + `isUnique`), so on
   * valid data `vetSlug` is a no-op. Genuinely empty / non-string input falls back to
   * `FALLBACK_SLUG`.
   */
  readonly slug: string;
  /** The resolved roster face — its `.variable` class mounts on the scope wrapper. */
  readonly font: FontFace;
}

/** The shape the route hands in. Kept loose; `resolveScope` treats input as `unknown`. */
export interface ScopeSeed {
  /** Sanitized to a CSS-safe `[a-z0-9-]` token per entry; empty/non-string → `FALLBACK_SLUG`. */
  readonly slug: string;
  /** A roster `fontKey`; unknown → shell mono fallback via `resolveFontKey`. */
  readonly fontKey: string;
}

export const FALLBACK_SLUG = "fallback";

/**
 * The shell mono face, reused when a `fontKey` does not resolve. This is an already-loaded shell
 * variable (root layout), NOT a new `next/font` import, so the `preload:false` roster policy is
 * untouched. Shaped as a `FontFace`: it has no roster `.variable` class to mount (the shell var
 * is already in scope on `<html>`), hence the empty `variable`.
 */
const SHELL_MONO_FACE: FontFace = {
  variable: "",
  cssVariable: "--font-geist-mono",
};

/** The font fallback stack appended after the resolved face's CSS variable in `--font-face`. */
export const FONT_STACK = "ui-monospace, monospace";

// Sanitize an untrusted slug into a CSS-selector-safe token: lowercased and stripped to
// `[a-z0-9-]`, so it can never break out of the `[data-entry="…"]` selector — a hostile
// `"]}body{…}` sanitizes to inert characters, no injection.
//
// We SANITIZE the slug rather than collapse every unrecognized one to a single constant, so each
// entry keeps its OWN `[data-entry]` scope: a real entry slug is already `[a-z0-9-]` and passes
// through unchanged, staying UNIQUE per entry, while only genuinely empty / non-string input
// falls back to the constant. (Decoupled from `COMPONENT_KEYS` — which module renders in the
// slot is a separate resolution; an entry can carry a brand font before it has a module.)
function vetSlug(slug: unknown): string {
  if (typeof slug !== "string") return FALLBACK_SLUG;
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return safe.length > 0 ? safe : FALLBACK_SLUG;
}

/**
 * Resolve an arbitrary, untrusted seed into a safe `ResolvedScope`.
 * Total function: every input — `null`, a number, a hostile object, an unknown `fontKey` — maps
 * to a valid scope. It never throws.
 */
export function resolveScope(seed: unknown): ResolvedScope {
  try {
    const obj = (typeof seed === "object" && seed !== null ? seed : {}) as {
      slug?: unknown;
      fontKey?: unknown;
    };

    // Unknown / non-string fontKey → NotFound → shell mono fallback.
    const fontKey = obj.fontKey;
    const resolution =
      typeof fontKey === "string"
        ? resolveFontKey(fontKey)
        : resolveFontKey("");
    const font = resolution.found ? resolution.value : SHELL_MONO_FACE;

    return { slug: vetSlug(obj.slug), font };
  } catch {
    // Belt-and-suspenders: the logic above can't throw (a `slug` getter that throws is caught
    // here), but the catch makes the never-throw contract structural rather than a thing a
    // future edit can break.
    return { slug: FALLBACK_SLUG, font: SHELL_MONO_FACE };
  }
}
