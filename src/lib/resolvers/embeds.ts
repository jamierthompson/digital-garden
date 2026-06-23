// embedKey resolver [D10, D15, §4.1, §6]. Resolves an `embedKey` (from a
// Portable Text `liveEmbed` block) to its embed component loader, returning a
// typed `NotFound` for an unknown key — the caller renders a "missing embed"
// placeholder in the serializer rather than crashing the essay.
//
// The registry is **empty until a widget exists**. The shared embed registry
// starts single-tier; a project-local tier is added only when a second project
// reuses a widget [D24, §4.1]. When that happens the per-project resolver
// composes the two (`{ ...shared, ...projectLocal }`) so a project-local key
// overrides a shared one.
//
// PHASE 3+: like project loaders, embed entries are LITERAL lazy imports per key
// (`"hue-slider": () => import("@/embeds/HueSlider")`), never templated [D21].
// Adding an embed also means adding its key to `EMBED_KEYS` in keys.ts — the
// `satisfies` below then forces a matching loader entry (compile error if not).

import { type EmbedKey } from "@/lib/keys";

import { found, notFound, type Resolution } from "./resolution";

/** Loads an embeddable component. Concrete shape finalized when embeds exist. */
export type EmbedLoader = () => Promise<unknown>;

// `satisfies Record<EmbedKey, EmbedLoader>` makes a missing loader a compile
// error the moment a key is added to `EMBED_KEYS` [D10]. Empty today.
const EMBED_LOADERS = {} satisfies Record<EmbedKey, EmbedLoader>;

// Two variables, two jobs — this split is PERMANENT, not a while-empty
// workaround. `EMBED_LOADERS` keeps its literal type so `satisfies` enforces
// completeness against `EmbedKey`. `loaders` is the widened, string-keyed view
// the resolver indexes: `resolveEmbedKey` takes a raw `string` (a key from a
// Portable Text block, with no compile-time guarantee it's an `EmbedKey`), so
// indexing the typed `Record<EmbedKey, …>` directly would always be a type
// error. The widened view is required for that lookup forever — even once the
// registry is full.
const loaders: Readonly<Record<string, EmbedLoader>> = EMBED_LOADERS;

/**
 * Resolve an `embedKey` to its embed loader. Returns `NotFound` for an unknown
 * key — which today is every key, since the registry is empty.
 */
export function resolveEmbedKey(key: string): Resolution<EmbedLoader> {
  const loader = loaders[key];
  return loader ? found(loader) : notFound("embed", key);
}
