import type { ComponentType } from "react";

import { resolveEmbedKey } from "@/lib/resolvers/embeds";
import { isNotFound } from "@/lib/resolvers/resolution";

import styles from "./EmbedBlock.module.css";
import MissingEmbed from "./MissingEmbed";

interface EmbedBlockProps {
  /** The `embedKey` from a Portable Text `liveEmbed` block. */
  embedKey?: string;
  /** The editor-authored caption shown beneath the embed (optional). */
  caption?: string;
}

/**
 * Renders one `liveEmbed` block from an essay (§6, [D15]). An async Server Component: it
 * resolves the `embedKey` to its lazy loader via `resolveEmbedKey`, awaits the module, and
 * mounts the default export under the surrounding project scope so the widget themes
 * identically to the essay (§4.3).
 *
 * Defensive at the seam [D10, D19]: a missing or unresolved `embedKey` does NOT throw — it
 * renders the visible `MissingEmbed` placeholder, so a content→code key drift degrades
 * gracefully and the rest of the essay still reads. The loader returns `Promise<unknown>`
 * (the registry can't know each widget's concrete props), so the default export is narrowed
 * to a props-free `ComponentType` here — every embed themes off the ambient scope and takes
 * no props, matching `SunriseMeter`.
 */
export default async function EmbedBlock({
  embedKey,
  caption,
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
      <Embed />
      {caption ? (
        <figcaption className={styles.caption}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}
