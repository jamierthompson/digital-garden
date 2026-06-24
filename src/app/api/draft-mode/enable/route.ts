import { defineEnableDraftMode } from "next-sanity/draft-mode";

import { client } from "@/sanity/lib/client";

/**
 * Draft Mode ENABLE route. [D16]
 *
 * `defineEnableDraftMode` (next-sanity) wires the GET handler that Sanity
 * Presentation calls via `previewUrl.previewMode.enable`: it validates the
 * incoming preview request against the dataset using the token, then sets the
 * `__prerender_bypass` cookie via `await draftMode().enable()` (async Request API
 * under Next 16 — verified in
 * node_modules/next/dist/docs/.../04-functions/draft-mode.md). On success it
 * redirects to the URL Presentation asked to preview.
 *
 * The token is the server-only secret `SANITY_API_READ_TOKEN`, attached here with
 * `.withConfig` to the PUBLIC client instance purely to authorize the preview
 * handshake — it is NOT baked into any exported client. The draft READS happen
 * through `getClient(true)` (which builds the drafts-perspective client); this
 * route only flips the cookie. [security-and-ops §3]
 */
export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token: process.env.SANITY_API_READ_TOKEN }),
});
