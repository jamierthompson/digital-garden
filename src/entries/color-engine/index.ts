// Registry entry for the Color Engine entry module (#70, recomposed in #131, re-centered on
// an `Experience` in #154/#139). Resolved by the LITERAL dynamic import in
// `src/lib/resolvers/components.ts` keyed off `componentKey: "color-engine"`; its default
// export satisfies the `EntryModule` contract.
//
// The Color Engine is a prose-less wide canvas (owner directive): it composes as ONE `Experience` —
// `ColorEngineExperience` mounts the shared-state `ColorEngineProvider` around the `ColorEngineCanvas` grid,
// which lays every surface (seed, rules, cards, glossary, export, the reserved harmony region)
// out in one named-area CSS grid. `layout: "wide"` asks the `/[slug]` route for a
// screen-filling page. The module themes off the ambient entry scope; the palette it GENERATES
// is data (swatches, receipts, exports), never the module's own chrome.

import type { EntryModule } from "@/entries/types";

import ColorEngineExperience from "./ColorEngineExperience";

const colorEngine: EntryModule = {
  Experience: ColorEngineExperience,
  layout: "wide",
};

export default colorEngine;
