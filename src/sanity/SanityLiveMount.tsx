import { draftMode } from "next/headers";

import { SanityLive } from "@/sanity/lib/live";

/**
 * Mounts `<SanityLive>` once, near the root. [D11, D16]
 *
 * `<SanityLive>` opens the browser EventSource that pushes Content Lake change events
 * so pages revalidate live (published changes for every visitor; draft changes too
 * when `includeDrafts` is on AND a `browserToken` is configured). We set
 * `includeDrafts` from Draft Mode so standalone browser live-draft preview lights up
 * automatically once the owner mints `SANITY_API_BROWSER_TOKEN` — until then
 * `defineLive` forces it off, and previewing inside the Presentation Tool still works.
 *
 * `strict: true` (see `./lib/live.ts`) makes `includeDrafts` a required prop, which is
 * why this is its own tiny async server component: it resolves `draftMode()` the same
 * way the sibling `<VisualEditingControls>` does, keeping that request-API read OUT of
 * the synchronous `RootLayout` root (which must not become request-blocking — the
 * `[D11, D16]` Suspense invariant in `layout.tsx`). This is NOT Visual Editing — it
 * mounts no overlay — so it does not double up with `<VisualEditingControls>`.
 */
export default async function SanityLiveMount() {
  const { isEnabled } = await draftMode();
  return <SanityLive includeDrafts={isEnabled} />;
}
