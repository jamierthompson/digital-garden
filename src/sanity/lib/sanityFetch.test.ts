import { beforeEach, describe, expect, it, vi } from "vitest";

import { cacheLife } from "next/cache";

/**
 * `sanityFetch` is the single content read path, so its one job under test is the
 * branch: PUBLISHED client for a normal request, DRAFT client when Draft Mode is on.
 * The `use cache` directive is a no-op under Vitest (no Next compiler), so the function
 * runs as a plain async fn — exactly the seam we want to exercise. The native
 * cache-bypass-under-draft behaviour is the framework's job, verified by the bundled
 * docs and the browser pass, not jsdom.
 *
 * The runtime deps are mocked: `draftMode` (the request API the helper reads),
 * `getClient` (the client selector — stubbed to a fake `fetch` so no network touches
 * the test), and `cacheLife` (a no-op we assert the profile threads through to).
 */
const { fetchSpy, getClientSpy, draftModeSpy } = vi.hoisted(() => {
  const fetchSpy = vi.fn();
  return {
    fetchSpy,
    getClientSpy: vi.fn(() => ({ fetch: fetchSpy })),
    draftModeSpy: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/headers", () => ({ draftMode: draftModeSpy }));
vi.mock("./getClient", () => ({ getClient: getClientSpy }));

import { sanityFetch } from "./sanityFetch";

const QUERY = '*[_type == "project"]';

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy.mockResolvedValue([{ _id: "p1" }]);
});

describe("sanityFetch", () => {
  it("reads through the PUBLISHED client when Draft Mode is off", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: false });

    const result = await sanityFetch(QUERY);

    expect(getClientSpy).toHaveBeenCalledWith(false);
    expect(fetchSpy).toHaveBeenCalledWith(QUERY, undefined);
    expect(result).toEqual([{ _id: "p1" }]);
  });

  it("reads through the DRAFT client when Draft Mode is on", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: true });

    await sanityFetch(QUERY);

    expect(getClientSpy).toHaveBeenCalledWith(true);
  });

  it("forwards query params (so $slug is never string-interpolated)", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: false });

    await sanityFetch(QUERY, { slug: "first-light" });

    expect(fetchSpy).toHaveBeenCalledWith(QUERY, { slug: "first-light" });
  });

  it("threads the cacheLife profile through (defaulting to 'max')", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: false });

    await sanityFetch(QUERY);
    expect(cacheLife).toHaveBeenCalledWith("max");

    await sanityFetch(QUERY, undefined, "hours");
    expect(cacheLife).toHaveBeenCalledWith("hours");
  });
});
