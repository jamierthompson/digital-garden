import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `SanityLiveMount` exists to keep `<SanityLive>`'s `includeDrafts` (required under
 * `strict`) driven by Draft Mode WITHOUT a request-API read at the sync RootLayout root
 * [D11, D16]. Async server components aren't jsdom-renderable [D25], so we invoke it
 * directly and inspect the element it returns — the contract is just "pass draftMode's
 * isEnabled through to SanityLive".
 *
 * `@/sanity/lib/live` is mocked so importing it doesn't pull the Cache-Components
 * runtime; `SanityLive` becomes a marker component whose props we read off the element.
 */
const { draftModeSpy, SanityLiveMarker } = vi.hoisted(() => ({
  draftModeSpy: vi.fn(),
  SanityLiveMarker: () => null,
}));

vi.mock("next/headers", () => ({ draftMode: draftModeSpy }));
vi.mock("@/sanity/lib/live", () => ({ SanityLive: SanityLiveMarker }));

import SanityLiveMount from "./SanityLiveMount";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("SanityLiveMount", () => {
  it("mounts <SanityLive> with includeDrafts=false for a public visitor", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: false });

    const element = await SanityLiveMount();

    expect(element.type).toBe(SanityLiveMarker);
    expect(element.props.includeDrafts).toBe(false);
  });

  it("mounts <SanityLive> with includeDrafts=true under Draft Mode", async () => {
    draftModeSpy.mockResolvedValue({ isEnabled: true });

    const element = await SanityLiveMount();

    expect(element.props.includeDrafts).toBe(true);
  });
});
