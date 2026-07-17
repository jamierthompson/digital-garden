// Reference-by-key contracts — the single source of truth for which keys exist.
// Sanity stores these keys — `componentKey` and `slotKey`, plus the per-role font keys as the
// entry's `theme.{headingFont,bodyFont,monoFont}` — as FREE-TEXT string fields on its documents:
// the standalone Studio schema deliberately can't import this module (see the NOTE in
// studio/schemaTypes/documents/entry.ts), so there is no dropdown — code resolves the keys. This
// module owns the *allowed key values* and their types; resolvers (src/lib/resolvers/**) and the
// font roster (src/fonts/roster.ts) key off these, and the drift-net scripts
// (scripts/check-key-drift.mjs, scripts/check-published-keys.mjs) assert published Sanity keys stay
// members. Resolvers are typed `satisfies Record<Key, …>` so a missing entry is a compile error,
// and return a typed `NotFound` for an unknown key (a saved Sanity key whose code was
// renamed/deleted) rather than crashing.
//
// IMPORTANT — keep this module dependency-free and side-effect-free. It is imported by the app AND
// by the plain-Node drift-check scripts, so it must not pull in `next/font`, entry-module bundles,
// or any app-only code.

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
 * Component keys — one per coded entry module, resolved to a literal dynamic import
 * in `src/lib/resolvers/components.ts`. Each entry registers its key here when its
 * module lands; the `satisfies Record<ComponentKey, …>` on `ENTRY_LOADERS` then forces
 * a matching loader entry (compile error if missing).
 *
 * `componentKey` is capability-gated, not kind-gated: any kind — `now` included — can declare
 * one. An entry with no `componentKey` renders prose-only (a sketch demo carrying a
 * `theme.color` but no key yet, or an unkeyed note/essay); an entry that declares its key
 * here has the resolver map it to a literal dynamic import. `componentKey` is OPTIONAL for
 * every kind, mounting purely on presence (#226 removed the required-past-sketch
 * validator); a declared key that fails to resolve is a `notFound()` for any kind. The first
 * real module is the Color Engine (#70).
 */
export const COMPONENT_KEYS = [
  "color-engine",
] as const satisfies readonly string[];
export type ComponentKey = (typeof COMPONENT_KEYS)[number];

/**
 * Slot keys — in-essay live components / widgets, resolved in
 * `src/lib/resolvers/slots.ts`. The registry starts single-tier; a
 * entry-local tier is added only on a genuine second use.
 *
 * The `color-engine-*` keys are the Color Engine's slots (#131): the Color Engine composes
 * as an editorial page whose prose interleaves these slots, each in its own theme-scoped
 * container, sharing state through the module's `Provider`.
 */
export const SLOT_KEYS = [
  "color-engine-seed",
  "color-engine-rules",
  "color-engine-tokens",
  "color-engine-preview",
  "color-engine-export",
] as const satisfies readonly string[];
export type SlotKey = (typeof SLOT_KEYS)[number];

const FONT_KEY_SET: ReadonlySet<string> = new Set(FONT_KEYS);
const COMPONENT_KEY_SET: ReadonlySet<string> = new Set(COMPONENT_KEYS);
const SLOT_KEY_SET: ReadonlySet<string> = new Set(SLOT_KEYS);

/** Narrow an arbitrary string (e.g. a Sanity value) to a known `FontKey`. */
export function isFontKey(value: string): value is FontKey {
  return FONT_KEY_SET.has(value);
}

/** Narrow an arbitrary string to a known `ComponentKey`. */
export function isComponentKey(value: string): value is ComponentKey {
  return COMPONENT_KEY_SET.has(value);
}

/** Narrow an arbitrary string to a known `SlotKey`. */
export function isSlotKey(value: string): value is SlotKey {
  return SLOT_KEY_SET.has(value);
}
