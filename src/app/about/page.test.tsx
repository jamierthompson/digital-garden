import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// About is an async Server Component whose ONLY read is its own theme seed, resolved through
// `sitePageThemeSeed` → `sanityFetch(SITE_SETTINGS_QUERY)`. Mock that read path (query-aware so a
// wrong key is catchable) and neutralize the helper's `server-only` import (it throws outside a
// react-server condition; vitest sets none — same treatment as the home/entry page suites).
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));
vi.mock("server-only", () => ({}));

import { resolveThemeDeclarations } from "@/lib/theme";
import { SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";

import AboutPage from "./page";

const accentOf = (seed: unknown): string =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

const initScriptHtml = (container: HTMLElement): string =>
  [...container.querySelectorAll("script")]
    .map((s) => s.innerHTML)
    .find((html) => html.includes("setProperty")) ?? "";

// Feed the `about` key one seed and EVERY OTHER key a decoy — so if the page ever resolves the
// wrong `pageThemes.*` key (a copy-paste bug the `SitePageKey` type can't catch — every key is a
// valid string), the baked accent is the decoy's and the assertion fails.
const ABOUT_SEED = "#ca8a04"; // gold
const DECOY_SEED = "#0ea5e9"; // azure
function mockSettings(pageThemes: Record<string, string | null>): void {
  fetchMock.mockImplementation((query: string) =>
    Promise.resolve(query === SITE_SETTINGS_QUERY ? { pageThemes } : null),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("AboutPage", () => {
  it("renders the About heading and editorial prose", async () => {
    mockSettings({ about: ABOUT_SEED });
    render(await AboutPage());
    expect(
      screen.getByRole("heading", { level: 1, name: /about/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/personal portfolio and digital garden/i),
    ).toBeInTheDocument();
  });

  it("mounts PageTheme baking the accent from its OWN `pageThemes.about` seed (not another key's)", async () => {
    // Guard: the two seeds must produce distinct accents, else a wrong-key bug would be invisible.
    expect(accentOf(ABOUT_SEED)).not.toBe(accentOf(DECOY_SEED));
    mockSettings({
      home: DECOY_SEED,
      browse: DECOY_SEED,
      about: ABOUT_SEED,
      now: DECOY_SEED,
      system: DECOY_SEED,
    });
    const { container } = render(await AboutPage());
    const html = initScriptHtml(container);
    expect(html).toContain(accentOf(ABOUT_SEED));
    expect(html).not.toContain(accentOf(DECOY_SEED));
  });

  it("renders flash-free with a safe fallback when `pageThemes.about` is unauthored (null)", async () => {
    mockSettings({ about: null });
    const { container } = render(await AboutPage());
    // Still mounts the init script (fallback palette baked), never crashes on a missing seed.
    expect(initScriptHtml(container)).toContain("setProperty");
    expect(
      screen.getByRole("heading", { level: 1, name: /about/i }),
    ).toBeInTheDocument();
  });

  it("renders when there is no published siteSettings document at all (helper → null)", async () => {
    fetchMock.mockResolvedValue(null);
    const { container } = render(await AboutPage());
    expect(initScriptHtml(container)).toContain("setProperty");
    expect(
      screen.getByRole("heading", { level: 1, name: /about/i }),
    ).toBeInTheDocument();
  });
});
