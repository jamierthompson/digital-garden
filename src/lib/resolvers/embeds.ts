// embedKey resolver [D10, D15, §4.1, §6]. Resolves an `embedKey` (from a
// Portable Text `liveEmbed` block) to its embed component loader, returning a
// typed `NotFound` for an unknown key — the caller renders a "missing embed"
// placeholder in the serializer rather than crashing the essay.
//
// Single-tier registry by design: a project-local tier is added only when a
// second project reuses a widget [D24, §4.1].

import { type EmbedKey } from "@/lib/keys";

import { found, notFound, type Resolution } from "./resolution";

/** Loads an embeddable component. */
export type EmbedLoader = () => Promise<unknown>;

// `satisfies Record<EmbedKey, EmbedLoader>` makes a missing loader a compile
// error the moment a key is added to `EMBED_KEYS` [D10]. Each value is a LITERAL
// lazy import per key [D21] — never templated.
const EMBED_LOADERS = {
  "sunrise-meter": () => import("@/embeds/SunriseMeter"),
} satisfies Record<EmbedKey, EmbedLoader>;

// Two variables, two jobs. `EMBED_LOADERS` keeps its literal type so `satisfies`
// enforces completeness against `EmbedKey`; `loaders` is the widened, string-keyed
// view the resolver indexes — `resolveEmbedKey` takes a raw `string` (a Portable
// Text key with no compile-time `EmbedKey` guarantee), so indexing the typed
// `Record<EmbedKey, …>` directly would be a type error.
const loaders: Readonly<Record<string, EmbedLoader>> = EMBED_LOADERS;

/**
 * Resolve an `embedKey` to its embed loader. Returns `NotFound` for an unknown key.
 */
export function resolveEmbedKey(key: string): Resolution<EmbedLoader> {
  const loader = loaders[key];
  return loader ? found(loader) : notFound("embed", key);
}
