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
import { resolveEmbedKey } from "@/lib/resolvers/embeds";
import { isNotFound } from "@/lib/resolvers/resolution";

// Integration test of the Phase-3 primary flow — Sanity document → themed route → essay
// embed — with the Sanity fetch MOCKED so no network touches Vitest [D18]. It exercises the
// SYNCHRONOUS seams of the flow (scope resolution, scope render, key resolution, the
// missing-embed fallback); the async-RSC page render itself is jsdom-untestable and is the
// Chrome DevTools MCP browser check's job [D25] / Playwright's (testing.md "Async RSCs").
//
// The fixture is the real published `first-light` doc shape (id a8a749e9…), so the test
// tracks what actually ships, not an invented shape.

const FIRST_LIGHT = {
  _id: "a8a749e9-551b-417a-97ca-b3b611c5ed35",
  title: "First Light",
  slug: "first-light",
  blurb: "A dead-simple first entry.",
  brandColor: "oklch(0.7 0.15 70)",
  brandColorDark: null,
  fontKey: "newsreader",
  componentKey: "first-light",
  essay: [
    {
      _type: "liveEmbed" as const,
      _key: "embed1",
      embedKey: "sunrise-meter",
      caption: "The sunrise meter.",
    },
  ],
  notes: null,
  tags: ["portfolio"],
};

// Mock the Sanity client so `client.fetch` returns the fixture — no network in Vitest.
vi.mock("@/sanity/lib/client", () => ({
  client: { fetch: vi.fn(async () => FIRST_LIGHT) },
}));

describe("/work/[slug] primary flow (Sanity mocked)", () => {
  it("drives a real, non-fallback themed scope from the doc's brandColor + slug", () => {
    // The route hands ProjectScope { slug, brandColor, fontKey } from the doc. The slug
    // must resolve to its OWN scope (not collapse to `fallback`) now that KNOWN_SLUGS is
    // derived from COMPONENT_KEYS — that is the Phase-3 scopeSeed change.
    const scope = resolveScope({
      slug: FIRST_LIGHT.slug,
      brandColor: FIRST_LIGHT.brandColor,
      fontKey: FIRST_LIGHT.fontKey,
    });
    expect(scope.slug).toBe("first-light");
    // A parseable brand color yields a real engine palette, not the fallback.
    expect(scope.tokenSet.meta.isFallback).toBe(false);
    // The roster font resolved (newsreader is a real key), so its variable class is present.
    expect(scope.font.variable).not.toBe("");
  });

  it("renders the project themed with its own brand under its data-project scope", () => {
    const { container } = render(
      <ProjectScope
        seed={{
          slug: FIRST_LIGHT.slug,
          brandColor: FIRST_LIGHT.brandColor,
          fontKey: FIRST_LIGHT.fontKey,
        }}
      >
        <p>essay</p>
      </ProjectScope>,
    );
    const wrapper = container.querySelector("[data-project]");
    expect(wrapper).toHaveAttribute("data-project", "first-light");
    // React 19 hoists the `<style precedence>` into <head> (see ProjectScope.test.tsx); the
    // scoped block carries baked --brand-* literals selected on THIS island.
    const style = document.head.querySelector("style[data-precedence]");
    expect(style?.textContent).toContain('[data-project="first-light"]');
    expect(style?.textContent).toContain("--brand-");
  });

  it("resolves the essay's embed key to a loader, and the module key to its module", () => {
    const embed = resolveEmbedKey("sunrise-meter");
    expect(isNotFound(embed)).toBe(false);
    const component = resolveComponentKey(FIRST_LIGHT.componentKey);
    expect(isNotFound(component)).toBe(false);
  });

  it("renders the live embed (sunrise-meter) themed in the essay", async () => {
    // EmbedBlock is an async Server Component; awaiting it here yields its element tree,
    // which RTL then renders — the embed (SunriseMeter) appears with its caption.
    const ui = await EmbedBlock({
      embedKey: "sunrise-meter",
      caption: "The sunrise meter.",
    });
    render(ui);
    expect(screen.getByText("The sunrise meter.")).toBeInTheDocument();
    // SunriseMeter renders its own labelled meter figure.
    expect(screen.getByLabelText(/Dawn progress/i)).toBeInTheDocument();
  });

  it("shows the missing-embed placeholder for an unresolved embed key (no crash) [D10]", async () => {
    const ui = await EmbedBlock({ embedKey: "ghost-widget" });
    render(ui);
    expect(screen.getByText(/Embed unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/ghost-widget/)).toBeInTheDocument();
  });

  it("flags an unknown slug / componentKey as not-found (the route's notFound trigger) [D19]", () => {
    // An unpublished slug → null doc → route calls notFound(); a renamed componentKey →
    // NotFound from the resolver → route calls notFound(). Both are the typed-miss path.
    const unknownComponent = resolveComponentKey("deleted-module");
    expect(isNotFound(unknownComponent)).toBe(true);
  });
});
