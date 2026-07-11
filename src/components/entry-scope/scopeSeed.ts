// Pure, defensive resolution of an entry "scope seed" → the vetted slug + the theme faces for
// its interactive slot.
//
// The slot's COLOR comes from the page's `<html>` theme (every route stamps its authored seed
// there and the slot inherits it), so the only per-slot overrides are the entry's fonts: this
// module resolves each of the three role keys (`headingFont`/`bodyFont`/`monoFont`) through the
// roster (`resolveFontKey`) and hands `EntryScope` the faces to mount + map onto their role
// tokens. A role whose key is ABSENT or UNRESOLVABLE is simply OMITTED from `faces` — no override
// is emitted for it, so that role inherits `:root`'s editorial palette (nothing about that palette
// is hardcoded here).
//
// The defensive contract the stub established is preserved: `resolveScope` is TOTAL and NEVER
// throws. A bad/unknown font key drops the role rather than the render, and the slug is vetted to
// `[a-z0-9-]` so a hostile slug can never inject into the `[data-entry="…"]` selector. Keeping
// resolution pure (no React, no I/O) is what lets us unit-test the never-throw guarantee directly
// in jsdom instead of fighting an async RSC.

import { resolveFontKey } from "@/lib/resolvers/fonts";
import type { FontFace } from "@/fonts/roster";

/**
 * The resolved roster faces a themed slot overrides, one per role. A role appears here ONLY when
 * its seed key resolved to a real roster face; an absent/unresolvable role is omitted, so the
 * slot emits no override for it and it inherits `:root`.
 */
export interface ScopeFaces {
  readonly heading?: FontFace;
  readonly body?: FontFace;
  readonly mono?: FontFace;
}

/** A resolved scope: the vetted slug it is keyed on + the theme faces to mount. */
export interface ResolvedScope {
  /**
   * The selector key: the entry's slug, sanitized to `[a-z0-9-]` (never raw user input) so it is
   * **injection-safe** — it can't break out of `[data-entry="…"]`. UNIQUENESS per entry is
   * guaranteed upstream by the Sanity `slug` schema (charset `^[a-z0-9-]+$` + `isUnique`), so on
   * valid data `vetSlug` is a no-op. Genuinely empty / non-string input falls back to
   * `FALLBACK_SLUG`.
   */
  readonly slug: string;
  /** The resolved roster faces — each present face's `.variable` class mounts on the wrapper. */
  readonly faces: ScopeFaces;
}

/** The shape the route hands in. Kept loose; `resolveScope` treats input as `unknown`. */
export interface ScopeSeed {
  /** Sanitized to a CSS-safe `[a-z0-9-]` token per entry; empty/non-string → `FALLBACK_SLUG`. */
  readonly slug: string;
  /** A roster `fontKey` for the heading role; absent/unknown → the role inherits `:root`. */
  readonly headingFont?: string;
  /** A roster `fontKey` for the body role; absent/unknown → the role inherits `:root`. */
  readonly bodyFont?: string;
  /** A roster `fontKey` for the mono role; absent/unknown → the role inherits `:root`. */
  readonly monoFont?: string;
}

export const FALLBACK_SLUG = "fallback";

// Sanitize an untrusted slug into a CSS-selector-safe token: lowercased and stripped to
// `[a-z0-9-]`, so it can never break out of the `[data-entry="…"]` selector — a hostile
// `"]}body{…}` sanitizes to inert characters, no injection.
//
// We SANITIZE the slug rather than collapse every unrecognized one to a single constant, so each
// entry keeps its OWN `[data-entry]` scope: a real entry slug is already `[a-z0-9-]` and passes
// through unchanged, staying UNIQUE per entry, while only genuinely empty / non-string input
// falls back to the constant. (Decoupled from `COMPONENT_KEYS` — which module renders in the
// slot is a separate resolution; an entry can carry a theme font before it has a module.)
function vetSlug(slug: unknown): string {
  if (typeof slug !== "string") return FALLBACK_SLUG;
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return safe.length > 0 ? safe : FALLBACK_SLUG;
}

// Resolve one role's untrusted seed value to a roster face, or `undefined` when the value is
// absent (non-string) or a key the roster doesn't know — either way the role is omitted so it
// inherits `:root`.
function resolveFace(value: unknown): FontFace | undefined {
  if (typeof value !== "string") return undefined;
  const resolution = resolveFontKey(value);
  return resolution.found ? resolution.value : undefined;
}

/**
 * Resolve an arbitrary, untrusted seed into a safe `ResolvedScope`.
 * Total function: every input — `null`, a number, a hostile object, an unknown font key — maps
 * to a valid scope. It never throws.
 */
export function resolveScope(seed: unknown): ResolvedScope {
  try {
    const obj = (typeof seed === "object" && seed !== null ? seed : {}) as {
      slug?: unknown;
      headingFont?: unknown;
      bodyFont?: unknown;
      monoFont?: unknown;
    };

    const faces: ScopeFaces = {
      // A role is present ONLY when its key resolved — spread-away any `undefined` so an
      // omitted/unresolvable role never appears as a key at all.
      ...withFace("heading", resolveFace(obj.headingFont)),
      ...withFace("body", resolveFace(obj.bodyFont)),
      ...withFace("mono", resolveFace(obj.monoFont)),
    };

    return { slug: vetSlug(obj.slug), faces };
  } catch {
    // Belt-and-suspenders: the logic above can't throw (a `slug` getter that throws is caught
    // here), but the catch makes the never-throw contract structural rather than a thing a
    // future edit can break.
    return { slug: FALLBACK_SLUG, faces: {} };
  }
}

// Build `{ [role]: face }` when a face resolved, or `{}` when it didn't — so an omitted role is
// never present as an `undefined`-valued key on `faces`.
function withFace(
  role: keyof ScopeFaces,
  face: FontFace | undefined,
): ScopeFaces {
  return face ? { [role]: face } : {};
}
