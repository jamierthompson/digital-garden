// The shape every project module's registry entry (`index.ts`) exports (§4.1, §4.2).
//
// A `componentKey` resolves (via `src/lib/resolvers/components.ts`, a LITERAL dynamic
// import per key [D21]) to a project module; this is the contract that module's default
// export satisfies, so a thin `/work/[slug]` route can mount its pages uniformly without
// knowing the concrete project. Kept minimal for the dead-simple slice: a project is one
// or more pages, and the interactive experience is the only constant (§4.1). The page set
// is decided per project, not fixed by a template — so `Experience` is the required member
// and a project adds its own page components as it needs them.
//
// This type lives in a shared `src/projects/` module (not inside any one project) because
// it is the cross-module contract the resolver and route code key off; promoting a shared
// type to a shared file on its SECOND consumer is the standing discipline [D24]. The first
// project (`first-light`) is consumer one; the route/resolver is the second, so it earns
// its place here now rather than living inside `first-light/`.

import type { ComponentType } from "react";

/** A project module's registry entry — the default export of its `index.ts`. */
export interface ProjectModule {
  /**
   * The interactive experience component — the one constant every project has (§4.1).
   * A thin page mounts it [D20]. Props-free: it themes off the ambient project scope.
   */
  readonly Experience: ComponentType;
}
