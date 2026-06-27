import { PortableText, type PortableTextComponents } from "next-sanity";

// TypeGen output lives at the repo root (the `@/*` alias maps to `src/`, so it can't cover
// it) — this relative hop up to the root types file is intentional, not a deep `src` chain.
import type { PROJECT_DETAIL_QUERY_RESULT } from "../../../sanity.types";

import EmbedBlock from "./EmbedBlock";
import EssayFigure from "./EssayFigure";

// Lifted off the typed detail query so serializer and query can't drift. `NonNullable`
// drops the `essay: … | null` arm — the caller only renders this when an essay exists.
type Essay = NonNullable<NonNullable<PROJECT_DETAIL_QUERY_RESULT>["essay"]>;

/**
 * The Portable Text serializer for a project essay (§6, [D15, D19]). Renders the essay's
 * blocks plus the two authored embed kinds — `liveEmbed` → `EmbedBlock` (resolves the
 * `embedKey`, falls back to a visible placeholder on a miss [D10]) and `figure` →
 * `EssayFigure` [D15]; standard text blocks use the library defaults. The serializer is the
 * ONE place the essay meets code, so the embed-resolution seam lives here, not in the route.
 */
const components: PortableTextComponents = {
  types: {
    liveEmbed: ({ value }) => (
      <EmbedBlock embedKey={value.embedKey} caption={value.caption} />
    ),
    figure: ({ value }) => <EssayFigure value={value} />,
  },
};

export default function EssayBody({ value }: { value: Essay }) {
  return <PortableText value={value} components={components} />;
}
