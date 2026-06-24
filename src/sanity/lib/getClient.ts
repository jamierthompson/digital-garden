import { client, draftClient } from "./client";

/**
 * Pick the right Sanity client for a render. [D16]
 *
 * The single decision point a data-fetching Server Component should use, so the
 * "draft vs. published" branch lives in one place instead of being re-derived at
 * every call site:
 *
 *   import { draftMode } from "next/headers";
 *   import { getClient } from "@/sanity/lib/getClient";
 *
 *   const { isEnabled } = await draftMode();
 *   const data = await getClient(isEnabled).fetch(QUERY);
 *
 * When Draft Mode is ON we return the drafts-capable client *with the server-only
 * read token attached* (`.withConfig`), so the drafts perspective is actually
 * authorized — the bare `draftClient` has no token by design (the token must never
 * be a module-level constant that could be bundled). The token is read here, in a
 * server-only module path, straight from the environment. [security-and-ops §3]
 *
 * When Draft Mode is OFF we return the public, CDN-backed, published-only client —
 * the default for every public visitor.
 */
export function getClient(isDraftMode: boolean) {
  if (!isDraftMode) {
    return client;
  }

  const token = process.env.SANITY_API_READ_TOKEN;
  if (!token) {
    // Fail loud, not silent: draft mode without a token would quietly fall back
    // to published content and the author would see stale data with no signal.
    throw new Error(
      "Draft mode is enabled but SANITY_API_READ_TOKEN is not set. " +
        "Set the server-only read token (see .env.example / security-and-ops §3).",
    );
  }

  return draftClient.withConfig({ token });
}
