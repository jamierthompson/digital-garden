import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Draft Mode DISABLE route. [D16]
 *
 * Deletes the `__prerender_bypass` cookie so the visitor returns to ordinary
 * published rendering. `draftMode()` is an async Request API under Next 16 — it
 * must be awaited before `.disable()` (verified in
 * node_modules/next/dist/docs/.../04-functions/draft-mode.md). The
 * `next-sanity` Visual Editing overlay links to this route to leave preview.
 *
 * If linked with `<Link>`, pass `prefetch={false}` so a prefetch doesn't delete
 * the cookie prematurely (per the same bundled doc).
 */
export async function GET() {
  const draft = await draftMode();
  draft.disable();
  redirect("/");
}
