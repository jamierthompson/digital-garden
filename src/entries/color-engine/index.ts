// Registry entry for the Color Engine entry module. Resolved by the LITERAL dynamic import in
// `src/lib/resolvers/components.ts` keyed off `componentKey: "color-engine"`; its default export
// satisfies the `EntryModule` contract.

import type { EntryModule } from "@/entries/types";

import ColorEngineExperience from "./ColorEngineExperience";

const colorEngine: EntryModule = {
  Slot: ColorEngineExperience,
};

export default colorEngine;
