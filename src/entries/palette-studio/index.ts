// Registry entry for the Palette Studio entry module (#70, recomposed in #131).
// Resolved by the LITERAL dynamic import in `src/lib/resolvers/components.ts` keyed off
// `componentKey: "palette-studio"`; its default export satisfies the `EntryModule`
// contract.
//
// The studio has NO monolithic `Experience`: it composes as an editorial page whose prose
// interleaves the `palette-studio-*` liveEmbed slots (each in its own brand-scoped
// container). `Provider` is the shared-state frame the route wraps the article in; the
// slots read it via `useStudio`. The module themes off the ambient entry scope; the
// palette it GENERATES is data (swatches, receipts, exports), never the module's own chrome.

import type { EntryModule } from "@/entries/types";

import StudioProvider from "./StudioProvider";

const paletteStudio: EntryModule = { Provider: StudioProvider };

export default paletteStudio;
