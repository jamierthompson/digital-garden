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
   * The host entry's font-scope seed. Present whenever a non-`now` entry themes OR mounts a
   * module (`themeColor || componentKey`, not just a project): each embed then mounts inside its
   * OWN `EntryScope` container, so it wears the entry's theme font while the prose around it
   * keeps the editorial body face. Color is inherited from the page's `<html>` theme, so this
   * seed carries only the slug + `fontKey`. A module-only entry (no `fontKey`) still gets a seed
   * keyed on its own slug, so its embeds fall back to the shell font. Absent (a `now`, or an
   * entry that neither themes nor mounts a module) → the embed mounts bare.
   */
  scope?: ScopeSeed;
}

/**
 * Renders one `liveEmbed` block from an essay. An async Server Component that
 * resolves the `embedKey` to its lazy loader via `resolveEmbedKey`, awaits the module, and
 * mounts the default export — inside its own `EntryScope` when the host entry carries a
 * themed (`scope`), bare otherwise.
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
