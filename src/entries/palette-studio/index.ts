// Registry entry for the Palette Studio entry module (#70, recomposed in #131, re-centered on
// an `Experience` in #154/#139). Resolved by the LITERAL dynamic import in
// `src/lib/resolvers/components.ts` keyed off `componentKey: "palette-studio"`; its default
// export satisfies the `EntryModule` contract.
//
// The studio is a prose-less wide canvas (owner directive): it composes as ONE `Experience` —
// `StudioExperience` mounts the shared-state `StudioProvider` around the `StudioCanvas` grid,
// which lays every surface (seed, rules, cards, glossary, export, the reserved harmony region)
// out in one named-area CSS grid. `layout: "wide"` asks the `/[slug]` route for a
// screen-filling page. The module themes off the ambient entry scope; the palette it GENERATES
// is data (swatches, receipts, exports), never the module's own chrome.

import type { EntryModule } from "@/entries/types";

import StudioExperience from "./StudioExperience";

const paletteStudio: EntryModule = {
  Experience: StudioExperience,
  layout: "wide",
};

export default paletteStudio;
