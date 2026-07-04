import type { ComponentType } from "react";

import EntryScope from "@/components/entry-scope/EntryScope";
import EntryScopeBoundary from "@/components/entry-scope/EntryScopeBoundary";
import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";
import { resolveEmbedKey } from "@/lib/resolvers/embeds";
import { isNotFound } from "@/lib/resolvers/resolution";

import styles from "./EmbedBlock.module.css";
import MissingEmbed from "./MissingEmbed";

interface EmbedBlockProps {
  /** The `embedKey` from a Portable Text `liveEmbed` block. */
  embedKey?: string;
  /** The editor-authored caption shown beneath the embed (optional). */
  caption?: string;
  /**
   * The host entry's brand-scope seed. Present only when the entry is a project: each
   * embed then mounts inside its OWN `EntryScope` container, so brand stays scoped to
   * the slot while the prose around it reads the editorial register. N embeds share ONE
   * hoisted `<style>` (React de-dupes by `href`), so per-slot scoping costs one extra
   * `[data-entry]` div per slot, not N style blocks.
   */
  scope?: ScopeSeed;
}

/**
 * Renders one `liveEmbed` block from an essay. An async Server Component that
 * resolves the `embedKey` to its lazy loader via `resolveEmbedKey`, awaits the module, and
 * mounts the default export — inside its own `EntryScope` when the host entry carries a
 * brand (`scope`), bare otherwise.
 *
 * Defensive at the seam: a missing or unresolved `embedKey` does NOT throw — it
 * renders the visible `MissingEmbed` placeholder, so a content→code key drift degrades
 * gracefully. The loader returns `Promise<unknown>` (the registry can't know each widget's
 * props), so the default export is narrowed to a props-free `ComponentType` — every embed
 * themes off the ambient scope and takes no props. The caption stays OUTSIDE the scope:
 * it is authored prose and reads the editorial register.
 */
export default async function EmbedBlock({
  embedKey,
  caption,
  scope,
}: EmbedBlockProps) {
  if (!embedKey) {
    return <MissingEmbed embedKey="(none)" />;
  }

  const resolution = resolveEmbedKey(embedKey);
  if (isNotFound(resolution)) {
    return <MissingEmbed embedKey={embedKey} />;
  }

  const mod = (await resolution.value()) as { default: ComponentType };
  const Embed = mod.default;

  return (
    <figure className={styles.embed}>
      {scope ? (
        // Same last-resort containment as the page-level slot: an unforeseen scope throw
        // degrades this ONE figure to the unthemed notice instead of blanking the article
        // through the route's error boundary.
        <EntryScopeBoundary>
          <EntryScope seed={scope}>
            <Embed />
          </EntryScope>
        </EntryScopeBoundary>
      ) : (
        <Embed />
      )}
      {caption ? (
        <figcaption className={styles.caption}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}
