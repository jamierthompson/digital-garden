import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

/**
 * The revalidate webhook's whole job is a guarded mapping: a SIGNED Sanity webhook whose
 * payload carries a `_type` becomes `revalidateTag("sanity:<_type>", { expire: 0 })` plus
 * the `sanity` catch-all — and EVERY unhappy path (no secret, bad/missing signature,
 * unparseable body, no `_type`) returns a non-200 WITHOUT revalidating. The two boundaries
 * we don't own are mocked: `parseBody` (signature verify + body parse, from
 * `next-sanity/webhook`) and `revalidateTag` (the Next cache API). Mocking `parseBody` also
 * skips its real ~3s Content-Lake wait, so the suite stays fast.
 */
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("next-sanity/webhook", () => ({ parseBody: vi.fn() }));

import { POST } from "./route";

// The mocked imports ARE the spies — reference them directly (house style: see
// sanityFetch.test.ts), so the imports stay used and the seams read by their real names.
const parseBodySpy = vi.mocked(parseBody);
const revalidateTagSpy = vi.mocked(revalidateTag);

// `parseBody` is mocked, so the request is never actually read here — a bare stub stands
// in for the NextRequest the handler only forwards to `parseBody`.
const fakeReq = {} as NextRequest;

const SECRET = "test-secret";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SANITY_REVALIDATE_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.SANITY_REVALIDATE_SECRET;
});

describe("POST /api/revalidate", () => {
  it("revalidates `sanity:<_type>` + the `sanity` catch-all on a valid signature", async () => {
    parseBodySpy.mockResolvedValue({
      isValidSignature: true,
      body: { _type: "entry", _id: "e1", slug: "first-light" },
    });

    const res = await POST(fakeReq);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      revalidated: true,
      tags: ["sanity:entry", "sanity"],
    });
    // Immediate expiration (`{ expire: 0 }`) — the published change must show on the next
    // request, not stale-while-revalidate. Specific tag first, then the catch-all.
    expect(revalidateTagSpy.mock.calls).toEqual([
      ["sanity:entry", { expire: 0 }],
      ["sanity", { expire: 0 }],
    ]);
  });

  it("derives the type tag from the payload `_type` (e.g. siteSettings)", async () => {
    parseBodySpy.mockResolvedValue({
      isValidSignature: true,
      body: { _type: "siteSettings", _id: "siteSettings" },
    });

    const res = await POST(fakeReq);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      revalidated: true,
      tags: ["sanity:siteSettings", "sanity"],
    });
  });

  it("passes the secret AND the Content-Lake-wait flag to parseBody", async () => {
    parseBodySpy.mockResolvedValue({
      isValidSignature: true,
      body: { _type: "entry" },
    });

    await POST(fakeReq);

    expect(parseBodySpy).toHaveBeenCalledWith(fakeReq, SECRET, true);
  });

  it("returns 401 and does NOT revalidate on a bad signature", async () => {
    parseBodySpy.mockResolvedValue({
      isValidSignature: false,
      body: { _type: "entry" },
    });

    const res = await POST(fakeReq);

    expect(res.status).toBe(401);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it("returns 401 when the signature header is missing (parseBody → null)", async () => {
    // parseBody returns `isValidSignature: null` when the signature header is absent.
    parseBodySpy.mockResolvedValue({ isValidSignature: null, body: null });

    const res = await POST(fakeReq);

    expect(res.status).toBe(401);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it("fails LOUD with 500 and never calls parseBody when the secret is unset", async () => {
    delete process.env.SANITY_REVALIDATE_SECRET;

    const res = await POST(fakeReq);

    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toMatch(/SANITY_REVALIDATE_SECRET/);
    // Critical: we must NOT reach parseBody — with no secret it performs no validation.
    expect(parseBodySpy).not.toHaveBeenCalled();
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it("returns 400 (not a thrown 500) when the body cannot be parsed", async () => {
    parseBodySpy.mockRejectedValue(
      new SyntaxError("Unexpected token < in JSON"),
    );

    const res = await POST(fakeReq);

    expect(res.status).toBe(400);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when a valid, signed payload has no `_type`", async () => {
    // e.g. an empty body: parseBody yields `body: null` with a valid signature.
    parseBodySpy.mockResolvedValue({ isValidSignature: true, body: null });

    const res = await POST(fakeReq);

    expect(res.status).toBe(400);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  // Adversarial QA additions: the cases above cover the happy path + each rejection
  // branch where `body` is null; these attack the branches a non-null payload opens — a
  // present-but-typeless body, a falsy `_type`, attacker-supplied tag fields, secret leakage.

  it("returns 400 (no revalidate) for a signed body that is present but has no `_type`", async () => {
    // Distinct from the `body: null` case above: here `body` is a real object, so the
    // guard rests entirely on the `body?._type` optional read being undefined — exercising
    // the `!type` branch with a truthy body, the shape a real Sanity webhook with a
    // misconfigured projection would send.
    parseBodySpy.mockResolvedValue({
      isValidSignature: true,
      body: { _id: "p1", slug: "first-light" },
    });

    const res = await POST(fakeReq);

    expect(res.status).toBe(400);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it("returns 400 (no revalidate) when `_type` is an empty string", async () => {
    // `""` is falsy, so `!type` must catch it — otherwise we'd revalidate the garbage tag
    // `sanity:` (and the catch-all) off an empty type.
    parseBodySpy.mockResolvedValue({
      isValidSignature: true,
      body: { _type: "", _id: "p1" },
    });

    const res = await POST(fakeReq);

    expect(res.status).toBe(400);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it("ignores attacker-supplied `tags`/`tag` fields — tags derive from `_type` ONLY", async () => {
    // Tag-injection probe: even on a fully VALID, signed request, a payload smuggling its
    // own `tags`/`tag` must NOT aim revalidation anywhere but `sanity:<_type>` + `sanity`.
    // The handler must never read these fields.
    parseBodySpy.mockResolvedValue({
      isValidSignature: true,
      body: {
        _type: "entry",
        _id: "e1",
        tags: ["sanity:siteSettings", "evil"],
        tag: "admin",
      } as never,
    });

    const res = await POST(fakeReq);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      revalidated: true,
      tags: ["sanity:entry", "sanity"],
    });
    // Exactly the two server-derived tags — nothing the attacker named.
    expect(revalidateTagSpy.mock.calls).toEqual([
      ["sanity:entry", { expire: 0 }],
      ["sanity", { expire: 0 }],
    ]);
    const revalidatedTags = revalidateTagSpy.mock.calls.map(([tag]) => tag);
    expect(revalidatedTags).not.toContain("evil");
    expect(revalidatedTags).not.toContain("admin");
    expect(revalidatedTags).not.toContain("sanity:siteSettings");
  });

  it("never echoes the secret in any response body", async () => {
    // Defense in depth: a valid request must not leak `SANITY_REVALIDATE_SECRET` into the
    // response. (The 500-on-unset path can't leak it — there's no secret then.)
    parseBodySpy.mockResolvedValue({
      isValidSignature: true,
      body: { _type: "entry" },
    });

    const res = await POST(fakeReq);

    expect(JSON.stringify(await res.json())).not.toContain(SECRET);
  });
});
