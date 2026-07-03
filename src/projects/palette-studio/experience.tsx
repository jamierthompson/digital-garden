"use client";

// The interactive Palette Studio experience. The client boundary lives at THIS leaf so the
// route (`app/[slug]/page.tsx`) and the surrounding editorial chrome stay server-rendered.
//
// Slice 1 stands up the wiring + headless core (derive.ts / rules.ts) and mounts a minimal
// shell; Slice 2 (#70) builds the full UI — seed row, rules rail, primitives board, token
// table, and anchor readout — on top of the same pure core.

import type { ExperienceProps } from "@/projects/types";

import { DEFAULT_GAMUT, DEFAULT_RULES } from "./rules";
import { derivePalette, describeAnchor } from "./derive";

const STARTER_SEED = "oklch(0.66 0.2 350)";

export default function Experience({
  slug,
}: ExperienceProps): React.ReactElement {
  const palette = derivePalette(STARTER_SEED, DEFAULT_RULES, DEFAULT_GAMUT);
  return (
    <section aria-labelledby={`${slug}-studio-heading`}>
      <h2 id={`${slug}-studio-heading`}>Palette Studio</h2>
      <p>{describeAnchor(palette)}</p>
    </section>
  );
}
