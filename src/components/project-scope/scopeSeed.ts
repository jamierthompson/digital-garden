// Pure, defensive resolution of a project "scope seed" → a baked, scoped CSS theme.
//
// It resolves a `brandColor` through the OKLCH engine (`buildTokenSet` → dual-scheme, `light-dark()`,
// baked literals) and a `fontKey` through the font roster (`resolveFontKey`),
// then serializes everything into one `@layer brand { [data-project="…"] { … } }` block.
//
// The defensive contract the stub established is preserved exactly: `resolveScope`
// is TOTAL and NEVER throws. A bad/missing `brandColor` collapses to the engine's own
// fallback palette (`buildTokenSet` returns `meta.isFallback`); a bad/unknown `fontKey`
// collapses to the shell mono face via `resolveFontKey`'s `NotFound` branch; and the slug
// is vetted to a known constant so a hostile slug can never inject into the emitted CSS.
// Keeping resolution pure (no React, no I/O) is what lets us unit-test the never-throw
// guarantee directly in jsdom instead of fighting an async RSC.

import {
  buildTokenSet,
  tokenSetToDeclarations,
  type TokenSet,
} from "@garden/oklch";
import { resolveFontKey } from "@/lib/resolvers/fonts";
import type { FontFace } from "@/fonts/roster";

/** A resolved scope: the vetted slug it is keyed on + everything needed to emit its theme. */
export interface ResolvedScope {
  /**
   * The selector key: the project's slug, sanitized to `[a-z0-9-]` (never raw user input),
   * so it is both **injection-safe** (can't break out of `[data-project="…"]`) and **unique
   * per project** (distinct projects get distinct scopes + `<style>` hrefs — see `vetSlug`).
   * Genuinely empty / non-string input falls back to the constant `FALLBACK_SLUG`.
   */
  readonly slug: string;
  /** The engine's dual-scheme, baked token set for this scope's `brandColor`. */
  readonly tokenSet: TokenSet;
  /** The resolved roster face — its `.variable` class mounts on the scope wrapper. */
  readonly font: FontFace;
}

/** The shape the route hands in. Kept loose; `resolveScope` treats input as `unknown`. */
export interface ScopeSeed {
  /** Sanitized to a CSS-safe `[a-z0-9-]` token per project; empty/non-string → `FALLBACK_SLUG`. */
  readonly slug: string;
  /** Any color string (hex / `rgb()` / `oklch()`); unparseable → engine fallback. */
  readonly brandColor: string;
  /** A roster `fontKey`; unknown → shell mono fallback via `resolveFontKey`. */
  readonly fontKey: string;
}

export const FALLBACK_SLUG = "fallback";

/**
 * The cascade layer the scoped theme is emitted into AND the React `precedence` the
 * `<style>` is hoisted with — ONE value, used on both sides. These two are halves of
 * one mechanism: the cascade slots the rule by `@layer` name while React orders the hoisted
 * `<style>` by precedence. Single-sourcing the literal here makes the invariant mechanical
 * rather than vigilance-dependent — `scopedStyleCss` builds `@layer ${BRAND_LAYER}` and
 * `ProjectScope` sets `precedence={BRAND_LAYER}`, so they cannot silently desync.
 */
export const BRAND_LAYER = "brand";

/**
 * The shell mono face, reused when a `fontKey` does not resolve. This is an
 * already-loaded shell variable (root layout), NOT a new `next/font` import, so the
 * `preload:false` roster policy is untouched. Shaped as a `FontFace` so the serializer
 * treats it uniformly: it has no roster `.variable` class to mount (the shell var is
 * already in scope on `<html>`), hence the empty `variable`.
 */
const SHELL_MONO_FACE: FontFace = {
  variable: "",
  cssVariable: "--font-geist-mono",
};

/** The font fallback stack appended after the resolved face's CSS variable. */
const FONT_STACK = "ui-monospace, monospace";

// Sanitize an untrusted slug into a CSS-selector-safe token: lowercased and stripped to
// `[a-z0-9-]`, so it can never break out of the `[data-project="…"]` selector or the
// `<style>` href — a hostile `"]}body{…}` sanitizes to inert characters, no injection.
//
// We SANITIZE the slug rather than collapse every unrecognized one to a single constant.
// Collapsing (the old behavior) made every project without a registered component module —
// e.g. the seed brands goldenrod / marginalia / tidepool — share the SAME
// `[data-project="fallback"]` scope AND the SAME `<style href="project-theme-fallback">`.
// React 19 de-dupes hoisted styles by `href` and keeps the FIRST committed, so navigating
// between two such projects cross-contaminated them (the second showed the first's theme).
// A real project slug is already `[a-z0-9-]`, so it passes through unchanged and stays
// UNIQUE per project; only genuinely empty / non-string input falls back to the constant.
// (Note: this is decoupled from `COMPONENT_KEYS` — which module renders in the slot is a
// separate resolution; a project can carry a brand theme before it has a component module.)
function vetSlug(slug: unknown): string {
  if (typeof slug !== "string") return FALLBACK_SLUG;
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return safe.length > 0 ? safe : FALLBACK_SLUG;
}

/**
 * Resolve an arbitrary, untrusted seed into a safe `ResolvedScope`.
 * Total function: every input — `null`, a number, a hostile object, a garbage
 * `brandColor`, an unknown `fontKey` — maps to a valid scope. It never throws.
 */
export function resolveScope(seed: unknown): ResolvedScope {
  try {
    const obj = (typeof seed === "object" && seed !== null ? seed : {}) as {
      slug?: unknown;
      brandColor?: unknown;
      fontKey?: unknown;
    };

    // `buildTokenSet` is itself defensive: unparseable input yields the fallback palette
    // and sets `meta.isFallback`, never throwing. Passing through `unknown` is
    // fine — it parses defensively internally.
    const tokenSet = buildTokenSet(obj.brandColor);

    // Unknown / non-string fontKey → NotFound → shell mono fallback.
    const fontKey = obj.fontKey;
    const resolution =
      typeof fontKey === "string"
        ? resolveFontKey(fontKey)
        : resolveFontKey("");
    const font = resolution.found ? resolution.value : SHELL_MONO_FACE;

    return { slug: vetSlug(obj.slug), tokenSet, font };
  } catch {
    // Belt-and-suspenders: the logic above can't throw (a `slug` getter that throws is
    // caught here), but the catch makes the never-throw contract structural rather than a
    // thing a future edit can break.
    return {
      slug: FALLBACK_SLUG,
      tokenSet: buildTokenSet(undefined),
      font: SHELL_MONO_FACE,
    };
  }
}

/**
 * Serialize a resolved scope into the scoped `<style>` body — ONE coherent rule wrapped in
 * `@layer brand`. The wrapper is hand-assembled here (rather than via `tokenSetToCss`)
 * so the engine's semantic-token declarations, the `--focus-ring-color` alias, and the
 * `--font-face` mapping all live in the SAME selector block. The slot re-binds the generic
 * semantic tokens (`--surface`, `--accent`, … `--success`) with the brand's solved values,
 * overriding the global editorial defaults for this island only. The `@layer ${BRAND_LAYER}`
 * wrapper here pairs with `ProjectScope`'s `precedence={BRAND_LAYER}` — see `BRAND_LAYER`.
 */
export function scopedStyleCss(scope: ResolvedScope): string {
  // Engine declarations: `color-scheme: light dark;` + each `--<name>: light-dark(…)`
  // (the generic semantic role tokens, incl. the #66 status tokens).
  const brandDecls = tokenSetToDeclarations(scope.tokenSet)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  // Alias the engine's focus-ring token into the var foundation's `:focus-visible` reads.
  const focusRing = "    --focus-ring-color: var(--focus-ring);";

  // Map the resolved roster face into `--font-face`; the `.variable` class on the wrapper
  // brings `var(<cssVariable>)` into scope, and the stack is the fallback.
  const fontFace = `    --font-face: var(${scope.font.cssVariable}), ${FONT_STACK};`;

  const body = [brandDecls, focusRing, fontFace].join("\n");
  return `@layer ${BRAND_LAYER} {\n  [data-project="${scope.slug}"] {\n${body}\n  }\n}`;
}
