import { PortableText, type PortableTextComponents } from "next-sanity";

// The generated TypeGen output lives at the repo root (no `@/*` alias covers it — that
// alias maps to `src/`), so this one relative hop up to the root types file is intentional,
// not a deep `src` chain. It keeps the serializer's essay type tied to the query result.
import type { PROJECT_DETAIL_QUERY_RESULT } from "../../../sanity.types";

import EmbedBlock from "./EmbedBlock";
import EssayFigure from "./EssayFigure";

// The essay's Portable Text type, lifted straight off the typed detail query so the
// serializer and the query can't drift. `NonNullable` drops the `essay: … | null` arm —
// the caller only renders this when an essay exists.
type Essay = NonNullable<NonNullable<PROJECT_DETAIL_QUERY_RESULT>["essay"]>;

/**
 * The Portable Text serializer for a project essay (§6, [D15, D19]).
 *
 * Renders the essay's blocks and the two authored embed kinds:
 *   • `liveEmbed` → `EmbedBlock`, which resolves the `embedKey` to a coded widget and
 *     falls back to a visible "missing embed" placeholder on an unresolved key [D10].
 *   • `figure`    → `EssayFigure`, a typed editorial image block [D15].
 * Standard text blocks use the library defaults. The serializer is the ONE place the essay
 * meets code, so the embed-resolution seam and its fallback live here, not in the route.
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
