// The `engine-board` module's REGISTRY ENTRY: the default export the `componentKey`
// "engine-board" resolves to via a literal dynamic import in
// `src/lib/resolvers/components.ts` (never a templated import — that defeats bundler static
// analysis). The resolver returns a typed `NotFound` for an unknown key, so a content→code
// key drift degrades to `not-found.tsx` rather than crashing.
//
// Unlike `first-light`, this module is pointed at by MANY seed brands at once (componentKey
// is not unique per project). It is the spree's end-to-end proof harness (#65): wrapped in
// each brand's `ProjectScope`, it renders that brand's engine-solved semantic + status tokens
// as swatches, so the engine's output is visible across the edge-case brand spread.
//
// It consumes only the GENERIC semantic tokens (`--surface`, `--accent`, `--text`, … the #66
// status tokens, `--font-face`) that `ProjectScope` re-binds on the `[data-project]` ancestor
// — no project-prefixed alias layer (#57). Dependencies point project → shared, never back,
// and never project → project (lint-enforced).

import type { ProjectModule } from "@/projects/types";

import EngineBoardExperience from "./experience";

/** The `engine-board` registry entry — satisfies the shared `ProjectModule` contract. */
const engineBoard: ProjectModule = {
  Experience: EngineBoardExperience,
};

export default engineBoard;
