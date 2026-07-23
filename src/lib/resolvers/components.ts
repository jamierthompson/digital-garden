// componentKey resolver. Resolves a Sanity `componentKey` to a
// lazy loader for that entry module, returning a typed `NotFound` for an
// unknown key rather than throwing (the caller renders `not-found.tsx`).

import { type ComponentKey } from "@/lib/keys";

import { found, notFound, type Resolution } from "./resolution";

/**
 * Loads an entry module, resolving to its module namespace.
 */
export type EntryLoader = () => Promise<unknown>;

// `satisfies Record<ComponentKey, EntryLoader>` makes a missing loader a
// compile error the moment a key is added to `COMPONENT_KEYS`. Each value is
// a LITERAL dynamic import per key — never a templated `import(`…/${slug}`)`,
// which defeats the bundler's static analysis and per-entry code-splitting.
// This file is the resolver registry — the ONE sanctioned shared→entry importer.
// The `boundaries/dependencies` rule recognizes it as its own `registry`
// element (see eslint.config.mjs), so these literal entry imports are allowed while
// the shared→entry ban still holds everywhere else — no per-line disable needed.
//
// Each entry is a LITERAL `import()` per key (never templated) so the bundler can
// code-split each entry module onto its own chunk. Empty until a real module registers its
// key in `COMPONENT_KEYS` — `ComponentKey` is `never`, so the `satisfies` is vacuously met and
// stays as the drift guard for when the first module lands.
const ENTRY_LOADERS = {} satisfies Record<ComponentKey, EntryLoader>;

// Two variables, two jobs. `ENTRY_LOADERS` keeps its literal type so `satisfies`
// enforces completeness against `ComponentKey`; `loaders` is the widened,
// string-keyed view the resolver indexes — `resolveComponentKey` takes a raw
// `string` (a Sanity key with no compile-time `ComponentKey` guarantee), so
// indexing the typed `Record<ComponentKey, …>` directly would be a type error.
const loaders: Readonly<Record<string, EntryLoader>> = ENTRY_LOADERS;

/**
 * Resolve a `componentKey` to its entry loader. Returns `NotFound` for an
 * unknown key (the caller renders `not-found.tsx`).
 */
export function resolveComponentKey(key: string): Resolution<EntryLoader> {
  // Own-property guard: a plain-object index resolves prototype members
  // ("__proto__", "constructor", "toString") to truthy non-loaders, which would
  // crash the page as a Found resolution (QA-131 D1).
  const loader = Object.hasOwn(loaders, key) ? loaders[key] : undefined;
  return loader ? found(loader) : notFound("component", key);
}
