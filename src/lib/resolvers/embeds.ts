// embedKey resolver. Resolves an `embedKey` (from a
// Portable Text `liveEmbed` block) to its embed component loader, returning a
// typed `NotFound` for an unknown key — the caller renders a "missing embed"
// placeholder in the serializer rather than crashing the essay.
//
// Single-tier registry by design: an entry-local tier is added only when a
// second entry module reuses a widget.

import { type EmbedKey } from "@/lib/keys";

import { found, notFound, type Resolution } from "./resolution";

/** Loads an embeddable component. */
export type EmbedLoader = () => Promise<unknown>;

// `satisfies Record<EmbedKey, EmbedLoader>` makes a missing loader a compile
// error the moment a key is added to `EMBED_KEYS`. Each value is a LITERAL
// lazy import per key — never templated (a templated import defeats bundler static analysis).
const EMBED_LOADERS = {
  "palette-studio-seed": () =>
    import("@/entries/palette-studio/slots/SeedSlot"),
  "palette-studio-rules": () =>
    import("@/entries/palette-studio/slots/RulesSlot"),
  "palette-studio-primitives": () =>
    import("@/entries/palette-studio/slots/PrimitivesSlot"),
  "palette-studio-tokens": () =>
    import("@/entries/palette-studio/slots/TokensSlot"),
  "palette-studio-preview": () =>
    import("@/entries/palette-studio/slots/PreviewSlot"),
  "palette-studio-receipt": () =>
    import("@/entries/palette-studio/slots/ReceiptSlot"),
  "palette-studio-export": () =>
    import("@/entries/palette-studio/slots/ExportSlot"),
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
  // Own-property guard: a plain-object index resolves prototype members
  // ("__proto__", "constructor", "toString") to truthy non-loaders, which would
  // crash the page as a Found resolution (QA-131 D1).
  const loader = Object.hasOwn(loaders, key) ? loaders[key] : undefined;
  return loader ? found(loader) : notFound("embed", key);
}
