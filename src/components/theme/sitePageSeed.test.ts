import { evaluate, parse } from "groq-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ENTRY_DETAIL_QUERY, SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";

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

/**
 * QA (#253): resolver-layer edges the happy path skips. `??` is presence-gated on
 * null/undefined ONLY, and the generated result type is wider at runtime than it reads.
 */
describe("sitePageThemeSeed — resolver edges (#253 QA)", () => {
  it("falls back to the default when `theme` is an EMPTY object (color absent, not null)", async () => {
    // `theme {color, colorDark}` on a settings doc whose theme exists but has no color
    // projects `{color: null}`; an object literal with the key absent is the sibling shape.
    fetchSpy.mockResolvedValue({ theme: {}, pageThemes: { home: null } });
    expect(await sitePageThemeSeed("home")).toBeNull();
  });

  it("falls back to the default when the override key is explicitly undefined", async () => {
    fetchSpy.mockResolvedValue({
      theme: { color: DEFAULT_SEED },
      pageThemes: { home: undefined },
    });
    expect(await sitePageThemeSeed("home")).toBe(DEFAULT_SEED);
  });

  it("returns null when `theme` is present but its color is null", async () => {
    fetchSpy.mockResolvedValue({
      theme: { color: null },
      pageThemes: null,
    });
    expect(await sitePageThemeSeed("now")).toBeNull();
  });

  it("never throws when the settings doc drifts to a non-object shape", async () => {
    // The optional chain is the only guard; a raw API write has no schema behind it.
    fetchSpy.mockResolvedValue("not-an-object");
    await expect(sitePageThemeSeed("browse")).resolves.toBeNull();
  });

  it("keeps an EMPTY-STRING site default as '' rather than coercing it to null", async () => {
    // Symmetry with the `""`-override case above: `??` does not skip "" at the LAST rung
    // either, so PageTheme (not this resolver) is what collapses it.
    fetchSpy.mockResolvedValue({ theme: { color: "" }, pageThemes: {} });
    expect(await sitePageThemeSeed("system")).toBe("");
  });
});

/**
 * QA (#253): the cross-surface invariant the two-rung chain exists to buy — a `now` update must
 * wear the same theme as the `/now` index it belongs to.
 *
 * The two seeds are resolved by DIFFERENT code paths that must agree by construction:
 *   • `/now` (the index page) → `sitePageThemeSeed("now")` → JS `??` over SITE_SETTINGS_QUERY.
 *   • a `now` entry page      → `ENTRY_DETAIL_QUERY.themeSeed` → GROQ `coalesce`/`select`.
 *
 * `??` and `coalesce` are both presence-gated, but on DIFFERENT vocabularies (JS: null AND
 * undefined; GROQ: null only) and over different projections. Each dataset shape below is run
 * through BOTH real paths — SITE_SETTINGS_QUERY executed with groq-js and fed to the resolver's
 * own fetch — and the two results asserted equal, so a future edit to either rung that de-syncs
 * the surfaces fails here rather than on the deployed site.
 */
describe("/now page seed vs now-entry seed — cross-surface agreement (#253 QA)", () => {
  const cases: Array<{
    name: string;
    settings: Record<string, unknown> | null;
  }> = [
    {
      name: "a /now override is authored",
      settings: {
        theme: { color: DEFAULT_SEED },
        pageThemes: { now: "#7c3aed" },
      },
    },
    {
      name: "no /now override — both fall to the site default",
      settings: { theme: { color: DEFAULT_SEED }, pageThemes: {} },
    },
    {
      name: "pageThemes absent entirely",
      settings: { theme: { color: DEFAULT_SEED } },
    },
    {
      name: "an explicitly null /now override",
      settings: { theme: { color: DEFAULT_SEED }, pageThemes: { now: null } },
    },
    {
      name: "an EMPTY-STRING /now override — both keep '' (engine fallback, not the default)",
      settings: { theme: { color: DEFAULT_SEED }, pageThemes: { now: "" } },
    },
    {
      name: "neither a /now override nor a site default",
      settings: { pageThemes: {} },
    },
    {
      name: "no settings document at all",
      settings: null,
    },
  ];

  it.each(cases)("agrees when $name", async ({ settings }) => {
    const dataset: unknown[] = [
      {
        _type: "entry",
        _id: "now-1",
        title: "A now update",
        slug: { current: "now-1" },
        kind: "now",
      },
    ];
    if (settings)
      dataset.push({ _type: "siteSettings", _id: "settings", ...settings });

    const projectedSettings = await (
      await evaluate(parse(SITE_SETTINGS_QUERY), { dataset })
    ).get();
    fetchSpy.mockResolvedValue(projectedSettings);
    const pageSeed = await sitePageThemeSeed("now");

    const entry = (await (
      await evaluate(parse(ENTRY_DETAIL_QUERY), {
        dataset,
        params: { slug: "now-1" },
      })
    ).get()) as { themeSeed: unknown };

    expect(pageSeed).toBe(entry.themeSeed);
  });
});
