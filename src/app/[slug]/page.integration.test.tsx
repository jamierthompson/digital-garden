import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/font/google is untransformed under Vitest (a build-time transform), so mock the
// faces the roster imports — loaded transitively via ProjectScope → resolveScope →
// FONT_FACES. Same shape as ProjectScope.test.tsx / roster.test.ts.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import EmbedBlock from "@/components/portable-text/EmbedBlock";
import ProjectScope from "@/components/project-scope/ProjectScope";
import { resolveScope } from "@/components/project-scope/scopeSeed";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { isNotFound } from "@/lib/resolvers/resolution";

// Integration test of the primary flow — Sanity document → themed slot → essay
// embed — with the Sanity fetch MOCKED so no network touches Vitest. It exercises the
// SYNCHRONOUS seams of the flow (scope resolution, scope render, the missing-embed
// fallback); the async-RSC page render itself is jsdom-untestable and is the Chrome
// DevTools MCP browser check's job / Playwright's (testing.md "Async RSCs").
//
// The fixture is a representative themed-entry doc shape — the theming/embed infrastructure
// is exercised directly here (no coded project module or registered embed ships post-#109,
// so the full page only mounts a slot once a real module lands; the seams below are the
// durable contract, and the embed registry now resolves every key to the missing-embed seam).

const THEMED_ENTRY = {
  _id: "themed-entry-fixture",
  title: "A Themed Slot",
  slug: "themed-slot",
  blurb: "A representative themed entry.",
  brandColor: "oklch(0.7 0.15 70)",
  brandColorDark: null,
  fontKey: "newsreader",
  notes: null,
};

// Mock the Sanity client so `client.fetch` returns the fixture — no network in Vitest.
vi.mock("@/sanity/lib/client", () => ({
  client: { fetch: vi.fn(async () => THEMED_ENTRY) },
}));

describe("/[slug] primary flow (Sanity mocked)", () => {
  it("drives a real, non-fallback themed scope from the doc's brandColor + slug", () => {
    // ProjectScope is handed { slug, brandColor, fontKey }. The slug passes through
    // `vetSlug` (sanitized `[a-z0-9-]`, unique per entry) to its OWN scope — it does not
    // collapse to `fallback` for a valid slug.
    const scope = resolveScope({
      slug: THEMED_ENTRY.slug,
      brandColor: THEMED_ENTRY.brandColor,
      fontKey: THEMED_ENTRY.fontKey,
    });
    expect(scope.slug).toBe("themed-slot");
    // A parseable brand color yields a real engine palette, not the fallback.
    expect(scope.tokenSet.meta.isFallback).toBe(false);
    // The roster font resolved (newsreader is a real key), so its variable class is present.
    expect(scope.font.variable).not.toBe("");
  });

  it("renders the slot themed with its own brand under its data-project scope", () => {
    const { container } = render(
      <ProjectScope
        seed={{
          slug: THEMED_ENTRY.slug,
          brandColor: THEMED_ENTRY.brandColor,
          fontKey: THEMED_ENTRY.fontKey,
        }}
      >
        <p>essay</p>
      </ProjectScope>,
    );
    const wrapper = container.querySelector("[data-project]");
    expect(wrapper).toHaveAttribute("data-project", "themed-slot");
    // React 19 hoists the `<style precedence>` into <head> (see ProjectScope.test.tsx); the
    // scoped block re-binds the generic semantic tokens with baked literals on THIS island.
    const style = document.head.querySelector("style[data-precedence]");
    expect(style?.textContent).toContain('[data-project="themed-slot"]');
    expect(style?.textContent).toContain("--accent: light-dark(");
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
