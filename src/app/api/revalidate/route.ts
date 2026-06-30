import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

/**
 * Sanity publish → production revalidation webhook.
 *
 * Published content is fetched under `use cache` + `cacheLife("max")`
 * (`src/sanity/lib/sanityFetch.ts`), so a PUBLISHED change does NOT appear on the
 * Vercel production deploy until a redeploy. This route expires the matching cache tag so
 * the change appears on the next request instead.
 *
 * Tag contract (kept in sync with the Live read-path slice): every fetch is tagged with
 * two coarse tags — `sanity` (catch-all) and `sanity:<_type>` (e.g. `sanity:project`).
 * We derive BOTH from the verified payload's `_type` server-side rather than trusting a
 * `tags` array, so a misconfigured webhook can't aim revalidation at an arbitrary tag.
 *
 * `revalidateTag`, not `updateTag`: `updateTag` throws outside a Server Action, and a
 * webhook is a Route Handler (…/04-functions/updateTag.md vs revalidateTag.md). We pass
 * `{ expire: 0 }` — the form the doc prescribes for webhooks needing immediate
 * expiration. `"max"` is stale-while-revalidate, so the FIRST visitor after a publish
 * would still see stale content (the observed bug — a fresh project missing from
 * `/work`); `{ expire: 0 }` makes the next request a blocking fresh fetch.
 *
 * `parseBody` verifies the `sanity-webhook-signature` HMAC against
 * `SANITY_REVALIDATE_SECRET`, and with the 3rd arg `true` waits ~3s for Content Lake
 * eventual consistency. It returns `isValidSignature: null` when the secret is absent
 * (NO validation performed), so we check the secret FIRST and fail loud.
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
