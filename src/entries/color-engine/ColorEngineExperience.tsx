// The Color Engine's `Experience` (#154, #139) — the single interactive slot the `/[slug]`
// route mounts inside the brand scope. It wraps the shared-state `ColorEngineProvider` around the
// `ColorEngineCanvas` grid, so every surface shares one engine run and one seed/rules store while
// the whole Color Engine lays out as one prose-less wide canvas.
//
// The client boundary stays low: this composer and the canvas are server components; only the
// provider frame and the slot leaves are client. `ColorEngineProvider` renders `ColorEngineCanvas` as
// its children, so the slots inside the grid read the context exactly as the old interleaved
// `liveEmbed`s did.

import type { ExperienceProps } from "@/entries/types";

import ColorEngineProvider from "./ColorEngineProvider";
import ColorEngineCanvas from "./ColorEngineCanvas";

export default function ColorEngineExperience({
  slug,
}: ExperienceProps): React.ReactElement {
  return (
    <ColorEngineProvider slug={slug}>
      <ColorEngineCanvas />
    </ColorEngineProvider>
  );
}
