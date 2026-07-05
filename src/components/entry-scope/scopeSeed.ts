// Pure, defensive resolution of a project "scope seed" → a baked, scoped CSS theme.
//
// It resolves a `brandColor` through the OKLCH engine (`buildTokenSet` → dual-scheme, `light-dark()`,
// baked literals) and a `fontKey` through the font roster (`resolveFontKey`),
// then serializes everything into one `@layer brand { [data-entry="…"] { … } }` block.
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
   * The selector key: the project's slug, sanitized to `[a-z0-9-]` (never raw user input) so
   * it is **injection-safe** — it can't break out of `[data-entry="…"]`. UNIQUENESS per
   * project is guaranteed upstream by the Sanity `slug` schema (charset `^[a-z0-9-]+$` +
   * `isUnique`), so on valid data `vetSlug` is a no-op; the theme `<style>` href additionally
   * carries a content hash (`hashCss`) so distinct themes never share a hoisted style and a
   * brand edit refreshes it. Genuinely empty / non-string input falls back to `FALLBACK_SLUG`.
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
 * `EntryScope` sets `precedence={BRAND_LAYER}`, so they cannot silently desync.
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
// `[a-z0-9-]`, so it can never break out of the `[data-entry="…"]` selector or the
// `<style>` href — a hostile `"]}body{…}` sanitizes to inert characters, no injection.
//
// We SANITIZE the slug rather than collapse every unrecognized one to a single constant.
// Collapsing (the old behavior) made every project without a registered component module —
// e.g. the seed brands goldenrod / marginalia / tidepool — share the SAME
// `[data-entry="fallback"]` scope AND the SAME `<style href="entry-theme-fallback">`.
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
 * A small, deterministic, ISOMORPHIC string hash (FNV-1a → base36). Used to key the theme
 * `<style>` href on its CONTENT: distinct themes get distinct hrefs, and a same-slug re-render
 * with an edited brand gets a NEW href so React 19 inserts the fresh `<style>` instead of
 * keeping the stale first-committed one (the Sanity live-preview edit loop). No crypto/Node
 * deps — the engine and this module stay isomorphic.
 */
export function hashCss(css: string): string {
  let h = 2166136261;
  for (let i = 0; i < css.length; i++) {
    h ^= css.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
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
 * wrapper here pairs with `EntryScope`'s `precedence={BRAND_LAYER}` — see `BRAND_LAYER`.
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
  return `@layer ${BRAND_LAYER} {\n  [data-entry="${scope.slug}"] {\n${body}\n  }\n}`;
}

/**
 * The CANVAS template's page-spanning background wash (the `kind === "project"` composition,
 * `/[slug]/page.tsx`). Re-binds ONLY `--bg` — never `--text`/`--border`/`--accent` — at `body`,
 * so SiteNav's ink hairline and SiteFooter's mono row (both read the global editorial tokens,
 * `docs/architecture.md`) stay untouched; just the wash color living behind them changes.
 *
 * Selector: `body:has(> main[data-template="canvas"]:not([style]) [data-entry="<slug>"])` —
 * NOT a bare `:root`/`body`, and NOT the simpler `body:has([data-entry="<slug>"])` an earlier
 * revision shipped. Both were proven unsafe by an ACTUAL browser repro (soft-navigating from
 * this canvas route to `/browse` left the pink wash on `/browse`'s body), not a hypothetical:
 *
 * - A bare `:root`/`body` override is unsafe because `<html>`/`<body>` never unmount across a
 *   client-side navigation — an orphaned rule would keep matching every future route forever.
 * - `body:has([data-entry="<slug>"])` alone is ALSO unsafe, because Cache Components keeps the
 *   previous `/[slug]` route mounted via React's `<Activity>` (`docs/architecture.md`) instead
 *   of unmounting it — confirmed live: this route's `<main>` got `style="display: none
 *   !important"` on it, not removed from the DOM, so its `[data-entry]` descendant was STILL
 *   present and `:has()` — which does not consider rendered visibility, only DOM structure —
 *   kept matching, leaking the wash forward onto the next route.
 *
 * The fix keys off the ONE thing that reliably tells the active copy from a hidden one:
 * react.dev/reference/react/Activity's own documented mechanism — "React will visually hide
 * its children using the `display: "none"` CSS property" — applies that inline `style` to the
 * hidden boundary and ONLY the hidden one. This component's own `<main data-template="canvas">`
 * IS that boundary (`/[slug]/page.tsx` never sets a `style` prop on it), so `:not([style])`
 * is true exactly while this route is the one actually on screen, and false the instant
 * Cache Components deactivates it — regardless of whether the DOM node or the hoisted
 * `<style>` tag itself lingers (see also `EntryScope.tsx`'s href-reuse comment: React's
 * hoisted styles aren't guaranteed removed on unmount either). Verified against the installed
 * react-dom 19.2.7 source and a live repro after the fix (see the browser QA notes in the PR).
 */
export function scopedWashCss(scope: ResolvedScope): string {
  // `buildTokenSet` unconditionally emits every `BrandTokenName` (see `BRAND_TOKEN_NAMES`),
  // so `--bg` is always present — the fallback below is defensive scaffolding, not a real
  // branch, matching `resolveScope`'s own never-throw posture.
  const bgDecl =
    tokenSetToDeclarations(scope.tokenSet)
      .split("\n")
      .find((line) => line.startsWith("--bg:")) ??
    "--bg: light-dark(#ffffff, #0a0a0a);";
  const selector = `body:has(> main[data-template="canvas"]:not([style]) [data-entry="${scope.slug}"])`;
  return `@layer ${BRAND_LAYER} {\n  ${selector} {\n    ${bgDecl}\n  }\n}`;
}
