import { draftMode } from "next/headers";
import Link from "next/link";
import { VisualEditing } from "next-sanity/visual-editing";

/**
 * Draft-mode-gated Visual Editing controls. [D16]
 *
 * A server component that renders NOTHING for ordinary public visitors and, only
 * when Draft Mode is active, mounts:
 * - `<VisualEditing />` (next-sanity) — the click-to-edit overlay that reads the
 *   stega-encoded source map the draft client emits and deep-links each editable
 *   string back to the Studio. Per [D16], click-to-edit is scoped at the data
 *   layer: `brandColor`/`fontKey`/etc. are stega-excluded in `client.ts`, so the
 *   overlay only targets prose/caption fields, never the code-consumed ones.
 * - an "Exit preview" link to the disable route, with `prefetch={false}` so a
 *   prefetch can't silently delete the bypass cookie (per the bundled draft-mode
 *   doc, node_modules/next/dist/docs/.../04-functions/draft-mode.md).
 *
 * `draftMode()` is an async Request API under Next 16 — awaited here. Because this
 * reads a request API, it must render inside a dynamic (non-cached) region; mount
 * it once near the root of the tree (e.g. the root layout `<body>`).
 *
 * INTEGRATION SEAM: the only file that should mount this is the Shell-owned root
 * layout (`src/app/layout.tsx`) — out of this agent's ownership. Shell mounts it
 * with a single `<VisualEditingControls />` line; this component owns the gating
 * and the overlay so Shell needs no Sanity knowledge.
 */
export default async function VisualEditingControls() {
  const { isEnabled } = await draftMode();

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <VisualEditing />
      <Link href="/api/draft-mode/disable" prefetch={false}>
        Exit preview
      </Link>
    </>
  );
}
