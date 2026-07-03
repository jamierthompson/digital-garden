// Registry entry for the Palette Studio project module (#70, recomposed in #131).
// Resolved by the LITERAL dynamic import in `src/lib/resolvers/components.ts` keyed off
// `componentKey: "palette-studio"`; its default export satisfies the `ProjectModule`
// contract.
//
// The studio has NO monolithic `Experience`: it composes as an editorial page whose prose
// interleaves the `palette-studio-*` liveEmbed slots (each in its own brand-scoped
// container). `Provider` is the shared-state frame the route wraps the article in; the
// slots read it via `useStudio`. The module themes off the ambient project scope; the
// palette it GENERATES is data (swatches, receipts, exports), never the module's own chrome.

import type { ProjectModule } from "@/projects/types";

import StudioProvider from "./StudioProvider";

const paletteStudio: ProjectModule = { Provider: StudioProvider };

export default paletteStudio;
