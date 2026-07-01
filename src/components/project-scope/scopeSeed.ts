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
import { COMPONENT_KEYS } from "@/lib/keys";
import type { FontFace } from "@/fonts/roster";

/** A resolved scope: the vetted slug it is keyed on + everything needed to emit its theme. */
export interface ResolvedScope {
  /**
   * The selector key. Always one of the known slugs or `FALLBACK_SLUG` — never raw user
   * input. This is load-bearing: because an unknown slug collapses to the constant
   * `FALLBACK_SLUG`, the slug we interpolate into the `[data-project="…"]` selector and
   * the `data-project` attribute is ALWAYS a vetted constant, so a hostile slug can never
   * inject into the emitted CSS.
   */
  readonly slug: string;
  /** The engine's dual-scheme, baked token set for this scope's `brandColor`. */
  readonly tokenSet: TokenSet;
  /** The resolved roster face — its `.variable` class mounts on the scope wrapper. */
  readonly font: FontFace;
}

/** The shape the route hands in. Kept loose; `resolveScope` treats input as `unknown`. */
export interface ScopeSeed {
  /** Vetted against `KNOWN_SLUGS`; an unknown slug collapses to `FALLBACK_SLUG`. */
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

// The slugs that may key a scope — DRIVEN from the registry. A project's slug equals its
// `componentKey` in our model, so `COMPONENT_KEYS` is the source of truth for which
// project slugs exist; `"garden"` is the shell island's slug; `"oklch-engine"` is asserted on
// by the scope tests. An unknown slug still collapses to `FALLBACK_SLUG`, which is what keeps a
// hostile slug out of the emitted selector — the set is always vetted constants, never raw input.
// Deriving from `COMPONENT_KEYS` means a new project is accepted automatically the moment it
// registers its key.
const KNOWN_SLUGS: ReadonlySet<string> = new Set<string>([
  ...COMPONENT_KEYS,
  "garden",
  "oklch-engine",
]);

/** Vet an untrusted slug down to a known constant — never returns raw input. */
function vetSlug(slug: unknown): string {
  return typeof slug === "string" && KNOWN_SLUGS.has(slug)
    ? slug
    : FALLBACK_SLUG;
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
