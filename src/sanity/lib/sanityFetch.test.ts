import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `sanityFetch` is the single content read path. Its jobs under test:
 *  - map Draft Mode → the right perspective/stega for `liveFetch` (`./live`);
 *  - fail LOUD when Draft Mode is on but the server token is missing (never a silent
 *    published fallback) (see security-and-ops.md);
 *  - return `liveFetch`'s `.data` unwrapped (call sites keep their typed result);
 *  - emit the coarse tag contract (`sanity` + `sanity:<_type>`).
 *
 * The `use cache` directive is a no-op under Vitest (no Next compiler), so the function
 * runs as a plain async fn — exactly the seam we want. `liveFetch` is mocked to a spy so
 * no `defineLive`/network machinery runs; `draftMode` is the request API the helper reads.
 */
const { liveFetchSpy, draftModeSpy } = vi.hoisted(() => ({
  liveFetchSpy: vi.fn(),
  draftModeSpy: vi.fn(),
}));

// `sanityFetch.ts` imports `server-only`, which throws when loaded outside a
// react-server condition (vitest sets none) — neutralize it so the module under test
// loads. The guard's real job (failing a client-bundle import) is a build-time concern.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ draftMode: draftModeSpy }));
vi.mock("./live", () => ({ liveFetch: liveFetchSpy, SanityLive: () => null }));

import { coarseTags, sanityFetch } from "./sanityFetch";

const QUERY = '*[_type == "project"]';
const TOKEN_VAR = "SANITY_API_READ_TOKEN";
let savedToken: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedToken = process.env[TOKEN_VAR];
  process.env[TOKEN_VAR] = "secret-token";
  liveFetchSpy.mockResolvedValue({
    data: [{ _id: "p1" }],
    sourceMap: null,
    tags: [],
  });
});

afterEach(() => {
  if (savedToken === undefined) delete process.env[TOKEN_VAR];
  else process.env[TOKEN_VAR] = savedToken;
});

describe("sanityFetch", () => {
  it("reads the PUBLISHED perspective with stega OFF when Draft Mode is off", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: false });

    const result = await sanityFetch(QUERY);

    expect(liveFetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: QUERY,
        perspective: "published",
        stega: false,
      }),
    );
    expect(result).toEqual([{ _id: "p1" }]);
  });

  it("reads the DRAFTS perspective with stega ON when Draft Mode is on", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: true });

    await sanityFetch(QUERY);

    expect(liveFetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ perspective: "drafts", stega: true }),
    );
  });

  it("forwards query params (so $slug is never string-interpolated)", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: false });

    await sanityFetch(QUERY, { slug: "first-light" });

    expect(liveFetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ params: { slug: "first-light" } }),
    );
  });

  it("throws loudly (never silently published) when the token is missing under Draft Mode", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: true });
    delete process.env[TOKEN_VAR];

    await expect(sanityFetch(QUERY)).rejects.toThrow(
      /SANITY_API_READ_TOKEN is not set/,
    );
    // The fail is the whole point: it must NOT fall through to a published read.
    expect(liveFetchSpy).not.toHaveBeenCalled();
  });

  it("does NOT require the token on the published path (off + no token still reads)", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: false });
    delete process.env[TOKEN_VAR];

    await expect(sanityFetch(QUERY)).resolves.toEqual([{ _id: "p1" }]);
    expect(liveFetchSpy).toHaveBeenCalledTimes(1);
  });

  it("emits the coarse tag contract for the fetch", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: false });

    await sanityFetch(QUERY);

    expect(liveFetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["sanity", "sanity:project"] }),
    );
  });
});

describe("coarseTags — the tag contract the publish webhook depends on", () => {
  it("always includes the bare `sanity` tag", () => {
    expect(coarseTags("*[true]")).toContain("sanity");
  });

  it.each([
    ['*[_type == "project"]{ _id }', "sanity:project"],
    ['*[_type == "siteSettings"][0]', "sanity:siteSettings"],
    ['*[_type == "note" && defined(slug.current)]', "sanity:note"],
    ["*[_type=='project']", "sanity:project"], // tolerant of single quotes / no spaces
  ])("derives %s → %s (plus the bare tag)", (query, expectedTypeTag) => {
    expect(coarseTags(query)).toEqual(["sanity", expectedTypeTag]);
  });

  it("dedupes when a type appears more than once", () => {
    expect(coarseTags('*[_type == "project" || _type == "project"]')).toEqual([
      "sanity",
      "sanity:project",
    ]);
  });
});
