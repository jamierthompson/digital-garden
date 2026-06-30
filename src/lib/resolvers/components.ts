// componentKey resolver. Resolves a Sanity `componentKey` to a
// lazy loader for that project module, returning a typed `NotFound` for an
// unknown key rather than throwing (the caller renders `not-found.tsx`).

import { type ComponentKey } from "@/lib/keys";

import { found, notFound, type Resolution } from "./resolution";

/**
 * Loads a project module, resolving to its module namespace.
 */
export type ProjectLoader = () => Promise<unknown>;

// `satisfies Record<ComponentKey, ProjectLoader>` makes a missing loader a
// compile error the moment a key is added to `COMPONENT_KEYS`. Each value is
// a LITERAL dynamic import per key — never a templated `import(`…/${slug}`)`,
// which defeats the bundler's static analysis and per-project code-splitting.
// This file is the resolver registry — the ONE sanctioned shared→project importer.
// The `boundaries/dependencies` rule recognizes it as its own `registry`
// element (see eslint.config.mjs), so these literal project imports are allowed while
// the shared→project ban still holds everywhere else — no per-line disable needed.
const PROJECT_LOADERS = {
  "first-light": () => import("@/projects/first-light"),
} satisfies Record<ComponentKey, ProjectLoader>;

// Two variables, two jobs. `PROJECT_LOADERS` keeps its literal type so `satisfies`
// enforces completeness against `ComponentKey`; `loaders` is the widened,
// string-keyed view the resolver indexes — `resolveComponentKey` takes a raw
// `string` (a Sanity key with no compile-time `ComponentKey` guarantee), so
// indexing the typed `Record<ComponentKey, …>` directly would be a type error.
const loaders: Readonly<Record<string, ProjectLoader>> = PROJECT_LOADERS;

/**
 * Resolve a `componentKey` to its project loader. Returns `NotFound` for an
 * unknown key (the caller renders `not-found.tsx`).
 */
export function resolveComponentKey(key: string): Resolution<ProjectLoader> {
  const loader = loaders[key];
  return loader ? found(loader) : notFound("component", key);
}
