// componentKey resolver [D10, D21, §4.2]. Resolves a Sanity `componentKey` to a
// lazy loader for that project module, returning a typed `NotFound` for an
// unknown key rather than throwing (the caller renders `not-found.tsx`).
//
// The registry is **empty until Phase 3** — no project modules exist yet. The
// type, the resolver, and the `NotFound` path are established now so Phase 3 only
// adds entries.
//
// ┌─ PHASE 3, READ THIS ────────────────────────────────────────────────────────┐
// │ Every entry MUST be a LITERAL dynamic import keyed per slug:                  │
// │                                                                               │
// │     "log-explorer": () => import("@/projects/log-explorer"),                  │
// │                                                                               │
// │ NEVER a templated `() => import(`@/projects/${slug}`)` — a templated import   │
// │ defeats the bundler's static analysis and breaks per-project code-splitting   │
// │ [D21]. One literal `import()` per key, nothing computed in the specifier.     │
// │ Adding a project also means adding its key to `COMPONENT_KEYS` in keys.ts —   │
// │ the `satisfies` below then forces a matching loader entry (compile error if   │
// │ you forget).                                                                  │
// └───────────────────────────────────────────────────────────────────────────┘

import { type ComponentKey } from "@/lib/keys";

import { found, notFound, type Resolution } from "./resolution";

/**
 * Loads a project module. The concrete module shape (its registry entry export)
 * is finalized in Phase 3 when the first project lands; until then a loader just
 * resolves to the module namespace.
 */
export type ProjectLoader = () => Promise<unknown>;

// `satisfies Record<ComponentKey, ProjectLoader>` makes a missing loader a
// compile error the moment a key is added to `COMPONENT_KEYS` [D10]. Empty today.
const PROJECT_LOADERS = {} satisfies Record<ComponentKey, ProjectLoader>;

// Two variables, two jobs — this split is PERMANENT, not a while-empty
// workaround. `PROJECT_LOADERS` keeps its literal type so `satisfies` enforces
// completeness against `ComponentKey`. `loaders` is the widened, string-keyed
// view the resolver indexes: `resolveComponentKey` takes a raw `string` (a key
// from Sanity, with no compile-time guarantee it's a `ComponentKey`), so
// indexing the typed `Record<ComponentKey, …>` directly would always be a type
// error. The widened view is required for that lookup forever — even once the
// registry is full.
const loaders: Readonly<Record<string, ProjectLoader>> = PROJECT_LOADERS;

/**
 * Resolve a `componentKey` to its project loader. Returns `NotFound` for an
 * unknown key — which today is every key, since the registry is empty (Phase 3).
 */
export function resolveComponentKey(key: string): Resolution<ProjectLoader> {
  const loader = loaders[key];
  return loader ? found(loader) : notFound("component", key);
}
