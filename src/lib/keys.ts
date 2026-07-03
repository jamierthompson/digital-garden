// Reference-by-key contracts — the single source of truth for which keys exist.
// Sanity stores keys (`componentKey`, `fontKey`, `embedKey`)
// on a project document; code resolves them. This module owns the *allowed key
// values* and their types; resolvers (src/lib/resolvers/**) and the font roster
// (src/fonts/roster.ts) key off these, and the Sanity schema builds its dropdowns
// from them. Resolvers are typed `satisfies Record<Key, …>` so a missing entry is
// a compile error, and return a typed `NotFound` for an unknown key (a saved
// Sanity key whose code was renamed/deleted) rather than crashing.
//
// IMPORTANT — keep this module dependency-free and side-effect-free. It is the
// contract both the app and the standalone Studio consume, so it must not
// pull in `next/font`, project bundles, or any app-only code (the Studio can't
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
  "jetbrains-mono",
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

/**
 * Component keys — one per coded project module, resolved to a literal dynamic import
 * in `src/lib/resolvers/components.ts`. Each project registers its key here when its
 * module lands; the `satisfies Record<ComponentKey, …>` on `PROJECT_LOADERS` then forces
 * a matching loader entry (compile error if missing).
 *
 * Currently EMPTY: the proof-of-concept mock modules were retired (#109), and the real
 * studies ship as `stage: sketch` with no coded module yet — a sketch project carries a
 * `brandColor` but no `componentKey`, so it renders prose-only. The first real module
 * (the Palette Studio, #70) registers the first key here.
 */
export const COMPONENT_KEYS = [] as const satisfies readonly string[];
export type ComponentKey = (typeof COMPONENT_KEYS)[number];

/**
 * Embed keys — shared in-essay live components / widgets, resolved in
 * `src/lib/resolvers/embeds.ts`. The registry starts single-tier; a
 * project-local tier is added only on a genuine second use.
 *
 * Currently EMPTY: the proof-of-concept `sunrise-meter` widget was retired with the mock
 * harness (#109). The generic `liveEmbed` Portable Text block + the resolver stay as the
 * infrastructure; the first real essay embed registers the first key here.
 */
export const EMBED_KEYS = [] as const satisfies readonly string[];
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
