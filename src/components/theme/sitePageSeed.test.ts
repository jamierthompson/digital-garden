import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `sitePageThemeSeed` resolves a site-owned page's authored theme seed: the page's own
 * `pageThemes` override when authored, else the site default (`siteSettings.theme.color`,
 * #253). Its jobs under test:
 *  - return the seed authored for the requested page key;
 *  - fall back to the site default when the page's override (or the whole `pageThemes`
 *    object) is unauthored;
 *  - degrade to `null` (never throw) when neither is authored or the settings doc is absent —
 *    so a page always has a safe value to hand `PageTheme`.
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

const DEFAULT_SEED = "#d04090";

describe("sitePageThemeSeed", () => {
  it("returns the authored override for each page key — the override outranks the default", async () => {
    fetchSpy.mockResolvedValue({
      theme: { color: DEFAULT_SEED },
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

  it("falls back to the site default for a key whose override is unauthored (null)", async () => {
    fetchSpy.mockResolvedValue({
      theme: { color: DEFAULT_SEED },
      pageThemes: { home: null },
    });
    expect(await sitePageThemeSeed("home")).toBe(DEFAULT_SEED);
  });

  it("falls back to the site default when the settings doc has no pageThemes object", async () => {
    fetchSpy.mockResolvedValue({
      theme: { color: DEFAULT_SEED },
      pageThemes: null,
    });
    expect(await sitePageThemeSeed("about")).toBe(DEFAULT_SEED);
  });

  it("keeps an EMPTY-STRING override as '' — bad data collapses to the engine fallback, it never re-routes to the default", async () => {
    // Deliberate: `??` falls through on null/undefined only. A `""` authored via the API is
    // bad data; PageTheme collapses it to the engine fallback palette rather than this
    // resolver silently substituting a different authored seed.
    fetchSpy.mockResolvedValue({
      theme: { color: DEFAULT_SEED },
      pageThemes: { browse: "" },
    });
    expect(await sitePageThemeSeed("browse")).toBe("");
  });

  it("returns null when neither the override nor the default is authored", async () => {
    fetchSpy.mockResolvedValue({ theme: null, pageThemes: { home: null } });
    expect(await sitePageThemeSeed("home")).toBeNull();
  });

  it("returns null when there is no published settings document", async () => {
    fetchSpy.mockResolvedValue(null);
    expect(await sitePageThemeSeed("system")).toBeNull();
  });
});
