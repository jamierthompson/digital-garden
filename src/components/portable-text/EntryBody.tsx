import { PortableText, type PortableTextComponents } from "next-sanity";

import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";

// TypeGen output lives at the repo root (the `@/*` alias maps to `src/`, so it can't cover
// it) — this relative hop up to the root types file is intentional, not a deep `src` chain.
import type { ENTRY_DETAIL_QUERY_RESULT } from "../../../sanity.types";

import EmbedBlock from "./EmbedBlock";
import EntryFigure from "./EntryFigure";

// Lifted off the typed detail query so serializer and query can't drift. `NonNullable`
// drops the `body: … | null` arm — the caller only renders this when a body exists.
type Body = NonNullable<NonNullable<ENTRY_DETAIL_QUERY_RESULT>["body"]>;

interface EntryBodyProps {
  value: Body;
  /**
   * The host entry's font-scope seed — set whenever a non-`now` entry themes OR mounts a
   * module (`theme.color || componentKey`), not just for a project. Keyed on the entry's own
   * slug, so a module-only entry still scopes its embeds under its own `[data-entry]`. Threaded
   * to each `liveEmbed` so every embed mounts in its own container wearing the entry's theme
   * font while the prose between them keeps the editorial body face (color comes from the page's
   * `<html>` theme, inherited by both). The serializer is per-render because the components map
   * closes over it; the map is tiny, so rebuilding it costs nothing measurable.
   */
  scope?: ScopeSeed;
}

/**
 * The Portable Text serializer for an entry's body. Renders the body's
 * blocks plus the two authored embed kinds — `liveEmbed` → `EmbedBlock` (resolves the
 * `embedKey`, falls back to a visible placeholder on a miss) and `figure` →
 * `EntryFigure`; standard text blocks use the library defaults. The serializer is the
 * ONE place the body meets code, so the embed-resolution seam lives here, not in the route.
 */
export default function EntryBody({ value, scope }: EntryBodyProps) {
  const components: PortableTextComponents = {
    types: {
      liveEmbed: ({ value: block }) => (
        <EmbedBlock
          embedKey={block.embedKey}
          caption={block.caption}
          scope={scope}
        />
      ),
      figure: ({ value: block }) => <EntryFigure value={block} />,
    },
  };
  return <PortableText value={value} components={components} />;
}
