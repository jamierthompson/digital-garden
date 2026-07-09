import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// System is an async Server Component whose ONLY read is its own theme seed, resolved through
// `sitePageThemeSeed` → `sanityFetch(SITE_SETTINGS_QUERY)`. Mock that read path (query-aware so a
// wrong key is catchable) and neutralize the helper's `server-only` import (throws outside a
// react-server condition; vitest sets none — same treatment as the home/entry page suites).
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));
vi.mock("server-only", () => ({}));

import { resolveThemeDeclarations } from "@/lib/theme";
import { SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";

import SystemPage from "./page";

const accentOf = (seed: unknown): string =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

// The hard-load theme is a `:root` <style> (ThemeStyle); read the baked CSS from the page's
// server markup.
const themeMarkup = async (): Promise<string> =>
  renderToStaticMarkup(await SystemPage());

// `system` gets one seed, every other key a decoy — a wrong-key resolution bakes the decoy accent.
const SYSTEM_SEED = "#7c3aed"; // violet
const DECOY_SEED = "#16a34a"; // green
function mockSettings(pageThemes: Record<string, string | null>): void {
  fetchMock.mockImplementation((query: string) =>
    Promise.resolve(query === SITE_SETTINGS_QUERY ? { pageThemes } : null),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("SystemPage", () => {
  it("renders the System stub (heading + lede)", async () => {
    mockSettings({ system: SYSTEM_SEED });
    render(await SystemPage());
    expect(
      screen.getByRole("heading", { level: 1, name: /system/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/being written/i)).toBeInTheDocument();
  });

  it("themes from its OWN `pageThemes.system` seed (not another key's)", async () => {
    expect(accentOf(SYSTEM_SEED)).not.toBe(accentOf(DECOY_SEED));
    mockSettings({
      home: DECOY_SEED,
      browse: DECOY_SEED,
      about: DECOY_SEED,
      now: DECOY_SEED,
      system: SYSTEM_SEED,
    });
    const html = await themeMarkup();
    expect(html).toContain(accentOf(SYSTEM_SEED));
    expect(html).not.toContain(accentOf(DECOY_SEED));
  });

  it("renders flash-free with a safe fallback when `pageThemes.system` is unauthored (null)", async () => {
    mockSettings({ system: null });
    expect(await themeMarkup()).toContain(":root{");
    render(await SystemPage());
    expect(
      screen.getByRole("heading", { level: 1, name: /system/i }),
    ).toBeInTheDocument();
  });

  it("renders when there is no published siteSettings document at all (helper → null)", async () => {
    fetchMock.mockResolvedValue(null);
    expect(await themeMarkup()).toContain(":root{");
    render(await SystemPage());
    expect(
      screen.getByRole("heading", { level: 1, name: /system/i }),
    ).toBeInTheDocument();
  });
});
