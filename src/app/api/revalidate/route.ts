import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

/**
 * Sanity publish → production revalidation webhook. [D11, D31]
 *
 * Closes the gap left by the published read path: content is fetched under
 * `use cache` + `cacheLife("max")` (see `src/sanity/lib/sanityFetch.ts`) [D11], so a
 * PUBLISHED change in Sanity does NOT appear on the Vercel production deploy until a
 * redeploy. This route lets Sanity tell the deploy "this `_type` changed" and we expire
 * the matching cache tag so the change appears on the next request — no redeploy.
 *
 * ── TAG CONTRACT (kept in sync with the Live read-path slice) ────────────────────────
 * Every content fetch is tagged with two COARSE cache tags:
 *   • `sanity`            — catch-all across all Sanity-backed reads
 *   • `sanity:<_type>`    — e.g. `sanity:project`, `sanity:siteSettings`, `sanity:note`
 * This handler reads the document `_type` from the verified webhook payload and expires
 * BOTH `sanity:<_type>` AND the `sanity` catch-all (cheap insurance against a fetch that
 * was tagged only with the catch-all). We deliberately derive the tags from `_type`
 * server-side rather than trusting a `tags` array in the payload — the handler owns the
 * contract, so a misconfigured webhook can't aim revalidation at an arbitrary tag.
 *
 * ── WHY `revalidateTag` (not `updateTag`) ────────────────────────────────────────────
 * `updateTag` can ONLY be called from a Server Action — it throws in a Route Handler
 * (node_modules/next/dist/docs/.../04-functions/updateTag.md). A webhook is a Route
 * Handler, so `revalidateTag` is the only valid call here
 * (…/04-functions/revalidateTag.md: "can be called in Server Functions and Route
 * Handlers"). We pass `{ expire: 0 }` — the form that doc explicitly prescribes for
 * "webhooks or third-party services that need immediate expiration". The alternative,
 * `"max"`, is stale-while-revalidate: the FIRST visitor after a publish would still see
 * stale content (exactly the observed bug — a fresh project missing from `/work`), with
 * fresh data arriving only on a later visit. `{ expire: 0 }` makes the next request a
 * blocking fresh fetch so the published change appears immediately — the right trade for
 * a low-traffic portfolio where correctness-on-publish beats shaving one cold fetch.
 *
 * ── SIGNATURE VERIFICATION ───────────────────────────────────────────────────────────
 * `parseBody` (re-exported by `next-sanity/webhook` from `@sanity/webhook`) reads the raw
 * body, verifies the `sanity-webhook-signature` HMAC against `SANITY_REVALIDATE_SECRET`,
 * and — with the 3rd arg `true` — waits ~3s for Content Lake eventual consistency so the
 * revalidated fetch reads the just-published value, not a stale CDN copy. It returns
 * `isValidSignature: null` when the secret is absent (NO validation performed), so we
 * check the secret FIRST and fail loud — never fall through to that unguarded path.
 *
 * Runs on the default Node.js runtime (NOT edge): signature verification uses Node crypto.
 */

/** Minimal shape of the webhook payload we depend on; tolerate a missing `slug`. */
type WebhookPayload = {
  _type?: string;
  _id?: string;
  slug?: string;
};

export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;

  // Fail LOUD on misconfiguration: without the secret, `parseBody` performs NO signature
  // validation (returns `isValidSignature: null`). A missing secret is a server fault, so
  // return 500 with a clear cause — never silently 200, never validate-less.
  if (!secret) {
    return new NextResponse(
      "Server misconfiguration: SANITY_REVALIDATE_SECRET is not set; refusing to revalidate.",
      { status: 500 },
    );
  }

  let isValidSignature: boolean | null;
  let body: WebhookPayload | null;
  try {
    ({ isValidSignature, body } = await parseBody<WebhookPayload>(
      req,
      secret,
      true, // wait ~3s for Content Lake eventual consistency before we revalidate
    ));
  } catch {
    // A malformed/non-JSON body makes `parseBody` throw at JSON.parse. Surface it as a
    // safe 4xx instead of letting it become an opaque 500 that hides the cause.
    return new NextResponse(
      "Malformed webhook payload (could not parse body).",
      {
        status: 400,
      },
    );
  }

  // `null` (missing signature header) or `false` (bad signature) → reject.
  if (!isValidSignature) {
    return new NextResponse("Invalid or missing webhook signature.", {
      status: 401,
    });
  }

  const type = body?._type;
  if (!type) {
    return new NextResponse(
      "Webhook payload is missing `_type`; nothing to revalidate.",
      { status: 400 },
    );
  }

  // Expire the specific type tag AND the catch-all. `{ expire: 0 }` = immediate
  // expiration so the published change is visible on the very next request.
  const tags = [`sanity:${type}`, "sanity"];
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }

  return NextResponse.json({ revalidated: true, tags });
}
