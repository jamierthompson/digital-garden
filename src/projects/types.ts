// The shape every project module's registry entry (`index.ts`) exports.
//
// A `componentKey` resolves (via `src/lib/resolvers/components.ts`, a LITERAL dynamic
// import per key) to a project module; this is the contract that module's default
// export satisfies, so a thin `/[slug]` route can mount its pages without knowing the
// concrete project. `Experience` is the only required member — a project adds its
// own page components as it needs them.
//
// Lives in shared `src/projects/` (not inside any one project) because it is the
// cross-module contract the resolver and route key off — named where it will live now,
// instantiated on a genuine second use (deferral discipline).

import type { ComponentType } from "react";

/** A project module's registry entry — the default export of its `index.ts`. */
export interface ProjectModule {
  /**
   * The interactive experience component — the one constant every project has.
   * A thin page mounts it. Props-free: it themes off the ambient project scope.
   */
  readonly Experience: ComponentType;
}
