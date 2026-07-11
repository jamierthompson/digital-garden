// Reference-by-key contracts — the single source of truth for which keys exist.
// Sanity stores these keys — `componentKey` and `embedKey`, plus the per-role font keys as the
// entry's `theme.{headingFont,bodyFont,monoFont}` — on its documents; code resolves them. This
// module owns the *allowed key
// values* and their types; resolvers (src/lib/resolvers/**) and the font roster
// (src/fonts/roster.ts) key off these, and the Sanity schema builds its dropdowns
// from them. Resolvers are typed `satisfies Record<Key, …>` so a missing entry is
// a compile error, and return a typed `NotFound` for an unknown key (a saved
// Sanity key whose code was renamed/deleted) rather than crashing.
//
// IMPORTANT — keep this module dependency-free and side-effect-free. It is the
// contract both the app and the standalone Studio consume, so it must not
// pull in `next/font`, entry-module bundles, or any app-only code (the Studio can't
// import `src/*`).

/**
 * Font keys — each resolves to a curated `next/font` face in the roster
 * (`src/fonts/roster.ts`). Adding a face is a code change; choosing among
 * existing faces is content (an editor picks from this set).
 */
export const FONT_KEYS = [
  "inter",
  "newsreader",
  "fraunces",
  "space-grotesk",
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

/**
 * Component keys — one per coded entry module, resolved to a literal dynamic import
 * in `src/lib/resolvers/components.ts`. Each entry registers its key here when its
 * module lands; the `satisfies Record<ComponentKey, …>` on `ENTRY_LOADERS` then forces
 * a matching loader entry (compile error if missing).
 *
 * `componentKey` is capability-gated, not kind-gated: any kind but `now` can declare one.
 * An entry with no `componentKey` renders prose-only (a sketch project carrying a
 * `theme.color` but no key yet, or an unkeyed note/essay); an entry that declares its key
 * here has the resolver map it to a literal dynamic import. A key is required for a project
 * past the sketch stage and optional-but-honored for a note or essay; a declared key that
 * fails to resolve is a `notFound()` for any kind. The first real module is the Color
 * Engine (#70).
 */
export const COMPONENT_KEYS = [
  "color-engine",
] as const satisfies readonly string[];
export type ComponentKey = (typeof COMPONENT_KEYS)[number];

/**
 * Embed keys — in-essay live components / widgets, resolved in
 * `src/lib/resolvers/embeds.ts`. The registry starts single-tier; a
 * entry-local tier is added only on a genuine second use.
 *
 * The `color-engine-*` keys are the Color Engine's slots (#131): the Color Engine composes
 * as an editorial page whose prose interleaves these embeds, each in its own theme-scoped
 * container, sharing state through the module's `Provider`.
 */
export const EMBED_KEYS = [
  "color-engine-seed",
  "color-engine-rules",
  "color-engine-tokens",
  "color-engine-preview",
  "color-engine-export",
] as const satisfies readonly string[];
export type EmbedKey = (typeof EMBED_KEYS)[number];

const FONT_KEY_SET: ReadonlySet<string> = new Set(FONT_KEYS);
const COMPONENT_KEY_SET: ReadonlySet<string> = new Set(COMPONENT_KEYS);
const EMBED_KEY_SET: ReadonlySet<string> = new Set(EMBED_KEYS);

/** Narrow an arbitrary string (e.g. a Sanity value) to a known `FontKey`. */
export function isFontKey(value: string): value is FontKey {
  return FONT_KEY_SET.has(value);
}

/** Narrow an arbitrary string to a known `ComponentKey`. */
export function isComponentKey(value: string): value is ComponentKey {
  return COMPONENT_KEY_SET.has(value);
}

/** Narrow an arbitrary string to a known `EmbedKey`. */
export function isEmbedKey(value: string): value is EmbedKey {
  return EMBED_KEY_SET.has(value);
}
