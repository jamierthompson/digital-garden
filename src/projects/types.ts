// The shape every project module's registry entry (`index.ts`) exports (§4.1, §4.2).
//
// A `componentKey` resolves (via `src/lib/resolvers/components.ts`, a LITERAL dynamic
// import per key [D21]) to a project module; this is the contract that module's default
// export satisfies, so a thin `/work/[slug]` route can mount its pages without knowing the
// concrete project. `Experience` is the only required member (§4.1) — a project adds its
// own page components as it needs them.
//
// Lives in shared `src/projects/` (not inside any one project) because it is the
// cross-module contract the resolver and route key off — the second-consumer promotion
// discipline [D24].

import type { ComponentType } from "react";

/** A project module's registry entry — the default export of its `index.ts`. */
export interface ProjectModule {
  /**
   * The interactive experience component — the one constant every project has (§4.1).
   * A thin page mounts it [D20]. Props-free: it themes off the ambient project scope.
   */
  readonly Experience: ComponentType;
}
