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
      body: { _type: "project", _id: "p1", slug: "first-light" },
    });

    const res = await POST(fakeReq);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      revalidated: true,
      tags: ["sanity:project", "sanity"],
    });
    // Immediate expiration (`{ expire: 0 }`) — the published change must show on the next
    // request, not stale-while-revalidate. Specific tag first, then the catch-all.
    expect(revalidateTagSpy.mock.calls).toEqual([
      ["sanity:project", { expire: 0 }],
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
      body: { _type: "note" },
    });

    await POST(fakeReq);

    expect(parseBodySpy).toHaveBeenCalledWith(fakeReq, SECRET, true);
  });

  it("returns 401 and does NOT revalidate on a bad signature", async () => {
    parseBodySpy.mockResolvedValue({
      isValidSignature: false,
      body: { _type: "project" },
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
});
