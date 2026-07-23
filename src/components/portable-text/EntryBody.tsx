import { PortableText, type PortableTextComponents } from "next-sanity";

import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";
import Text from "@/components/typography/Text";
import TextLink from "@/components/ui/TextLink";

// TypeGen output lives at the repo root (the `@/*` alias maps to `src/`, so it can't cover
// it) — this relative hop up to the root types file is intentional, not a deep `src` chain.
import type { ENTRY_DETAIL_QUERY_RESULT } from "../../../sanity.types";

import SlotBlock from "./SlotBlock";
import EntryFigure from "./EntryFigure";
import EntryVideo from "./EntryVideo";
import EntryQuote from "./EntryQuote";

// Lifted off the typed detail query so serializer and query can't drift. `NonNullable`
// drops the `body: … | null` arm — the caller only renders this when a body exists.
// Exported for the typed-block components that narrow their own member out of it.
export type Body = NonNullable<NonNullable<ENTRY_DETAIL_QUERY_RESULT>["body"]>;

/** The default Sanity link annotation — a bare `href`. Typed at the serializer boundary
 *  because Portable Text mark values arrive untyped. */
interface LinkAnnotation {
  href?: string;
}

interface EntryBodyProps {
  value: Body;
  /**
   * The host entry's font-scope seed — set whenever the entry mounts a module (any kind, `now`
   * included) or a non-`now` entry themes (`(!now && theme.color) || componentKey`). Keyed on the entry's own
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
  // The lede is the body's OWN first paragraph — the first `normal`-style block that is NOT a list
  // item — rendered a step up in size (the `lede` role) from the surrounding prose, same editorial
  // ink. It is not the `summary` (teaser + meta-description copy, no longer rendered on the page)
  // and not a schema field; it's derived here so an editor never maintains a parallel intro.
  // Editorial-only by construction: a demo has no body, so this serializer never runs for one.
  //
  // Matched by stable `_key`, NOT array index: @portabletext/react collapses consecutive list
  // items into one synthetic node (`nestLists`) before rendering, so a block serializer's `index`
  // diverges from this raw array once the body holds a list — which would drop the lede. List-item
  // blocks are skipped: they carry `style: "normal"` but render through the list serializer, not
  // `block.normal`.
  const firstProseKey = value.find(
    (block) =>
      block._type === "block" &&
      !block.listItem &&
      (block.style ?? "normal") === "normal",
  )?._key;

  const components: PortableTextComponents = {
    block: {
      normal: ({ children, value: block }) =>
        firstProseKey !== undefined && block._key === firstProseKey ? (
          <Text variant="lede" asChild>
            <p>{children}</p>
          </Text>
        ) : (
          <p>{children}</p>
        ),
    },
    marks: {
      // The default link annotation renders through the shared inline-link primitive so body
      // links wear the editorial accent treatment, not the UA default ink. Deliberately
      // minimal: same-tab navigation with the authored href verbatim — no target/rel
      // synthesis, no internal/external classification (link-behavior policy is a pending
      // design decision). An annotation with no usable href renders its children unlinked —
      // never an href="" anchor that self-navigates and traps keyboard/AT focus.
      link: ({ value, children }) => {
        const raw = (value as LinkAnnotation | undefined)?.href;
        if (typeof raw !== "string" || raw.trim() === "")
          return <>{children}</>;
        return (
          <TextLink variant="accent" href={raw}>
            {children}
          </TextLink>
        );
      },
    },
    types: {
      slot: ({ value: block }) => (
        <SlotBlock
          slotKey={block.slotKey}
          caption={block.caption}
          lane={block.lane}
          scope={scope}
        />
      ),
      // The first body block is the likely LCP element when it's a figure — preload it.
      figure: ({ value: block, index }) => (
        <EntryFigure value={block} preload={index === 0} />
      ),
      video: ({ value: block }) => <EntryVideo value={block} />,
      quote: ({ value: block }) => <EntryQuote value={block} />,
    },
  };
  return <PortableText value={value} components={components} />;
}
