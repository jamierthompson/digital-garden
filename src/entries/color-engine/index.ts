// Registry entry for the Color Engine entry module. Resolved by the LITERAL dynamic import in
// `src/lib/resolvers/components.ts` keyed off `componentKey: "color-engine"`; its default export
// satisfies the `EntryModule` contract.
//
// The interactive demo was removed so the design-system foundation could be rebuilt first (its
// cards carried pre-foundation type literals). The `componentKey` stays registered so the
// published entry still resolves — to the placeholder below — and the tool is rebuilt on the new
// foundation under the template epics.

import type { EntryModule } from "@/entries/types";

import ColorEngineStub from "./ColorEngineStub";

const colorEngine: EntryModule = {
  Experience: ColorEngineStub,
};

export default colorEngine;
