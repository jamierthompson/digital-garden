import type { ComponentType } from "react";

import EntryScope from "@/components/entry-scope/EntryScope";
import EntryScopeBoundary from "@/components/entry-scope/EntryScopeBoundary";
import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";
import Text from "@/components/typography/Text";
import { resolveBlockLane } from "@/lib/lanes";
import { resolveSlotKey } from "@/lib/resolvers/slots";
import { isNotFound } from "@/lib/resolvers/resolution";

import styles from "./SlotBlock.module.css";
import MissingSlot from "./MissingSlot";

interface SlotBlockProps {
  /** The `slotKey` from a Portable Text `slot` block. */
  slotKey?: string;
  /** The editor-authored caption shown beneath the slot (optional). */
  caption?: string;
  /** The authored content-grid lane (sanitized here; unknown values collapse to `wide`). */
  lane?: string | null;
  /**
   * The host entry's font-scope seed. Present whenever the entry mounts a module (any kind,
   * `now` included) or a non-`now` entry themes (`(!now && theme.color) || componentKey`): each
   * slot then mounts inside its OWN `EntryScope` container, so it wears the entry's theme fonts
   * while the prose around it keeps the editorial faces. Color is inherited from the page's
   * `<html>` theme, so this seed carries only the slug + the entry's per-role font keys
   * (heading/body/mono). A module-only entry (no font keys) — including any `now`, whose seed
   * omits the doc's fonts by design — still gets a seed keyed on its own slug, so its slots
   * inherit the site faces. Absent (an entry that neither themes nor mounts a module) → the
   * slot mounts bare.
   */
  scope?: ScopeSeed;
}

/**
 * Renders one `slot` block from an essay. An async Server Component that
 * resolves the `slotKey` to its lazy loader via `resolveSlotKey`, awaits the module, and
 * mounts the default export — inside its own `EntryScope` when the host entry carries a
 * themed (`scope`), bare otherwise.
 *
 * Defensive at the seam: a missing or unresolved `slotKey` does NOT throw — it
 * renders the visible `MissingSlot` placeholder, so a content→code key drift degrades
 * gracefully. The loader returns `Promise<unknown>` (the registry can't know each widget's
 * props), so the default export is narrowed to a props-free `ComponentType` — every slot
 * themes off the ambient scope and takes no props. The caption stays OUTSIDE the scope:
 * it is authored prose and reads the editorial register.
 */
export default async function SlotBlock({
  slotKey,
  caption,
  lane,
  scope,
}: SlotBlockProps) {
  if (!slotKey) {
    return <MissingSlot slotKey="(none)" />;
  }

  const resolution = resolveSlotKey(slotKey);
  if (isNotFound(resolution)) {
    return <MissingSlot slotKey={slotKey} />;
  }

  const mod = (await resolution.value()) as { default: ComponentType };
  const Slot = mod.default;

  return (
    <figure className={styles.slot} data-lane={resolveBlockLane(lane)}>
      {scope ? (
        // Same last-resort containment as the page-level slot: an unforeseen scope throw
        // degrades this ONE figure to the unthemed notice instead of blanking the article
        // through the route's error boundary.
        <EntryScopeBoundary>
          <EntryScope seed={scope}>
            <Slot />
          </EntryScope>
        </EntryScopeBoundary>
      ) : (
        <Slot />
      )}
      {caption ? (
        <Text variant="caption" asChild>
          <figcaption className={styles.caption}>{caption}</figcaption>
        </Text>
      ) : null}
    </figure>
  );
}
