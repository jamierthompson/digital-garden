import { PortableText, type PortableTextComponents } from "next-sanity";

import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";

// TypeGen output lives at the repo root (the `@/*` alias maps to `src/`, so it can't cover
// it) — this relative hop up to the root types file is intentional, not a deep `src` chain.
import type { ENTRY_DETAIL_QUERY_RESULT } from "../../../sanity.types";

import SlotBlock from "./SlotBlock";
import EntryFigure from "./EntryFigure";
import EntryVideo from "./EntryVideo";
import EntryQuote from "./EntryQuote";

// Lifted off the typed detail query so serializer and query can't drift. `NonNullable`
// drops the `body: … | null` arm — the caller only renders this when a body exists.
type Body = NonNullable<NonNullable<ENTRY_DETAIL_QUERY_RESULT>["body"]>;

interface EntryBodyProps {
  value: Body;
  /**
   * The host entry's font-scope seed — set whenever a non-`now` entry themes OR mounts a
   * module (`theme.color || componentKey`), not just for a project. Keyed on the entry's own
   * slug, so a module-only entry still scopes its slots under its own `[data-entry]`. Threaded
   * to each `slot` so every slot mounts in its own container wearing the entry's theme
   * fonts while the prose between them keeps the editorial faces (color comes from the page's
   * `<html>` theme, inherited by both). The serializer is per-render because the components map
   * closes over it; the map is tiny, so rebuilding it costs nothing measurable.
   */
  scope?: ScopeSeed;
}

/**
 * The Portable Text serializer for an entry's body. Renders the body's prose blocks plus the
 * four typed blocks in the shared palette — `slot` → `SlotBlock` (resolves the `slotKey`,
 * falls back to a visible placeholder on a miss), `figure` → `EntryFigure`, `video` →
 * `EntryVideo`, and `quote` → `EntryQuote`; standard text blocks use the library defaults.
 * The serializer is the ONE place the body meets code, so the slot-resolution seam lives
 * here, not in the route.
 */
export default function EntryBody({ value, scope }: EntryBodyProps) {
  const components: PortableTextComponents = {
    types: {
      slot: ({ value: block }) => (
        <SlotBlock
          slotKey={block.slotKey}
          caption={block.caption}
          scope={scope}
        />
      ),
      figure: ({ value: block }) => <EntryFigure value={block} />,
      video: ({ value: block }) => <EntryVideo value={block} />,
      quote: ({ value: block }) => <EntryQuote value={block} />,
    },
  };
  return <PortableText value={value} components={components} />;
}
