// The Palette Studio's `Experience` (#154, #139) — the single interactive slot the `/[slug]`
// route mounts inside the brand scope. It wraps the shared-state `StudioProvider` around the
// `StudioCanvas` grid, so every surface shares one engine run and one seed/rules store while
// the whole studio lays out as one prose-less wide canvas.
//
// The client boundary stays low: this composer and the canvas are server components; only the
// provider frame and the slot leaves are client. `StudioProvider` renders `StudioCanvas` as
// its children, so the slots inside the grid read the context exactly as the old interleaved
// `liveEmbed`s did.

import type { ExperienceProps } from "@/entries/types";

import StudioProvider from "./StudioProvider";
import StudioCanvas from "./StudioCanvas";

export default function StudioExperience({
  slug,
}: ExperienceProps): React.ReactElement {
  return (
    <StudioProvider slug={slug}>
      <StudioCanvas />
    </StudioProvider>
  );
}
