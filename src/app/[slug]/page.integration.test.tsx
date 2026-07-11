import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/font/google is untransformed under Vitest (a build-time transform), so mock the
// faces the roster imports — loaded transitively via EntryScope → resolveScope →
// FONT_FACES. Same shape as EntryScope.test.tsx / roster.test.ts.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
}));

import EmbedBlock from "@/components/portable-text/EmbedBlock";
import EntryScope from "@/components/entry-scope/EntryScope";
import { resolveScope } from "@/components/entry-scope/scopeSeed";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { isNotFound } from "@/lib/resolvers/resolution";

// Integration test of the primary flow — Sanity document → themed slot → essay
// embed — with the Sanity fetch MOCKED so no network touches Vitest. It exercises the
// SYNCHRONOUS seams of the flow (scope resolution, scope render, the missing-embed
// fallback); the async-RSC page render itself is jsdom-untestable and is the Chrome
// DevTools MCP browser check's job / Playwright's (testing.md "Async RSCs").
//
// The fixture is a representative themed-entry doc shape — the theming/embed infrastructure
// is exercised directly here (no coded entry module or registered embed ships post-#109,
// so the full page only mounts a slot once a real module lands; the seams below are the
// durable contract, and the embed registry now resolves every key to the missing-embed seam).

const THEMED_ENTRY = {
  _id: "themed-entry-fixture",
  title: "A Themed Slot",
  slug: "themed-slot",
  blurb: "A representative themed entry.",
  theme: {
    color: "oklch(0.7 0.15 70)",
    colorDark: null,
    bodyFont: "newsreader",
  },
  notes: null,
};

// Mock the Sanity client so `client.fetch` returns the fixture — no network in Vitest.
vi.mock("@/sanity/lib/client", () => ({
  client: { fetch: vi.fn(async () => THEMED_ENTRY) },
}));

describe("/[slug] primary flow (Sanity mocked)", () => {
  it("drives a real scope from the doc's slug + theme.bodyFont", () => {
    // EntryScope is handed { slug, headingFont?, bodyFont?, monoFont? }. The slug passes through
    // `vetSlug` (sanitized `[a-z0-9-]`, unique per entry) to its OWN scope — it does not collapse
    // to `fallback` for a valid slug — and the roster resolves the body role from the entry's theme.
    const scope = resolveScope({
      slug: THEMED_ENTRY.slug,
      bodyFont: THEMED_ENTRY.theme.bodyFont,
    });
    expect(scope.slug).toBe("themed-slot");
    // The roster body face resolved (newsreader is a real key), so it appears in `faces`.
    expect(scope.faces.body).toBeDefined();
    expect(scope.faces.body?.cssVariable).toBe("--font-newsreader");
  });

  it("renders the slot under its data-entry scope wearing the entry's theme font", () => {
    const { container } = render(
      <EntryScope
        seed={{
          slug: THEMED_ENTRY.slug,
          bodyFont: THEMED_ENTRY.theme.bodyFont,
        }}
      >
        <p>essay</p>
      </EntryScope>,
    );
    const wrapper = container.querySelector("[data-entry]") as HTMLElement;
    expect(wrapper).toHaveAttribute("data-entry", "themed-slot");
    // Color is inherited from the page's `<html>` theme; the only per-slot overrides are the
    // entry's fonts, mapped onto their role tokens inline on this island.
    expect(wrapper.style.getPropertyValue("--font-body")).toContain(
      "var(--font-newsreader)",
    );
  });

  it("shows the missing-embed placeholder for an unresolved embed key (no crash)", async () => {
    const ui = await EmbedBlock({ embedKey: "ghost-widget" });
    render(ui);
    expect(screen.getByText(/Embed unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/ghost-widget/)).toBeInTheDocument();
  });

  it("flags an unknown slug / componentKey as not-found (the route's notFound trigger)", () => {
    // An unpublished slug → null doc → route calls notFound(); a renamed componentKey →
    // NotFound from the resolver → route calls notFound(). Both are the typed-miss path.
    const unknownComponent = resolveComponentKey("deleted-module");
    expect(isNotFound(unknownComponent)).toBe(true);
  });
});
