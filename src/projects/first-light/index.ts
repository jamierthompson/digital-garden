// The `first-light` module's REGISTRY ENTRY: the default export the `componentKey`
// "first-light" resolves to via a literal dynamic import in
// `src/lib/resolvers/components.ts` ([D21] — never a templated import). The resolver
// returns a typed `NotFound` for an unknown key, so a content→code key drift degrades to
// `not-found.tsx` rather than crashing (§4.2, [D10]).
//
// Importing `tokens.css` here loads the project's `--logx-*` alias seam whenever the module
// loads, scoped to `[data-project="first-light"]`. Dependencies point project → shared,
// never back, and never project → project (lint-enforced, §1).

import type { ProjectModule } from "@/projects/types";

import "./tokens.css";
import FirstLightExperience from "./experience";

/** The `first-light` registry entry — satisfies the shared `ProjectModule` contract. */
const firstLight: ProjectModule = {
  Experience: FirstLightExperience,
};

export default firstLight;
