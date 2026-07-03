// Registry entry for the Palette Studio project module (#70). Resolved by the LITERAL
// dynamic import in `src/lib/resolvers/components.ts` keyed off `componentKey:
// "palette-studio"`; its default export satisfies the `ProjectModule` contract.
//
// The route mounts `Experience` inside `ProjectScope`, so this module themes off the ambient
// project scope; the palette it GENERATES is separate data (swatches, receipts, a scoped
// preview), never the module's own chrome.

import type { ProjectModule } from "@/projects/types";

import Experience from "./experience";

const paletteStudio: ProjectModule = { Experience };

export default paletteStudio;
