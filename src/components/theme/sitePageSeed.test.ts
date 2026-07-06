import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `sitePageThemeSeed` resolves a site-owned page's authored theme seed from
 * `siteSettings.pageThemes`. Its jobs under test:
 *  - return the seed authored for the requested page key;
 *  - degrade to `null` (never throw) when the settings doc, the `pageThemes` object, or the
 *    specific key is absent — so a page always has a safe value to hand `PageTheme`.
 *
 * `sitePageSeed.ts` imports `server-only` (throws outside a react-server condition; vitest sets
 * none) — neutralize it, exactly as `sanityFetch.test.ts` does. `sanityFetch` itself is mocked to
 * a spy so no `defineLive`/network machinery runs; the `use cache` directive is a no-op here.
 */
const { fetchSpy } = vi.hoisted(() => ({ fetchSpy: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchSpy }));

import { sitePageThemeSeed } from "./sitePageSeed";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sitePageThemeSeed", () => {
  it("returns the authored seed for each page key", async () => {
    fetchSpy.mockResolvedValue({
      pageThemes: {
        home: "#0ea5e9",
        browse: "#16a34a",
        about: "#ca8a04",
        now: "#db2777",
        system: "#7c3aed",
      },
    });
    expect(await sitePageThemeSeed("home")).toBe("#0ea5e9");
    expect(await sitePageThemeSeed("browse")).toBe("#16a34a");
    expect(await sitePageThemeSeed("about")).toBe("#ca8a04");
    expect(await sitePageThemeSeed("now")).toBe("#db2777");
    expect(await sitePageThemeSeed("system")).toBe("#7c3aed");
  });

  it("returns null for a key whose seed is unauthored (null)", async () => {
    fetchSpy.mockResolvedValue({ pageThemes: { home: null } });
    expect(await sitePageThemeSeed("home")).toBeNull();
  });

  it("returns null when the settings doc has no pageThemes object", async () => {
    fetchSpy.mockResolvedValue({ pageThemes: null });
    expect(await sitePageThemeSeed("about")).toBeNull();
  });

  it("returns null when there is no published settings document", async () => {
    fetchSpy.mockResolvedValue(null);
    expect(await sitePageThemeSeed("system")).toBeNull();
  });
});
