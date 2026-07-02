import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/font/google is a build-time transform, untransformed under Vitest — mock the faces
// pulled in transitively via ProjectScope → resolveScope → FONT_FACES (same shape as the
// integration test / ProjectScope.test.tsx).
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

// The published client is imported by the page module (generateStaticParams). Mock it so no
// env / network is required to import `./page`.
vi.mock("@/sanity/lib/client", () => ({
  client: { fetch: vi.fn(async () => []) },
}));

// Control the single read path the route uses for the entry document.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));

// notFound() throws in Next; mock it to a recognizable sentinel so we can assert the route
// took the not-found branch instead of rendering.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// Control component-key resolution so we exercise the PAGE's kind-gating branch without
// importing a real, heavy project module. `found`/`notFound` come from the real resolution
// module (unmocked) so `isNotFound` in the page narrows correctly.
const { resolveComponentKeyMock } = vi.hoisted(() => ({
  resolveComponentKeyMock: vi.fn(),
}));
vi.mock("@/lib/resolvers/components", () => ({
  resolveComponentKey: resolveComponentKeyMock,
}));

import {
  found,
  notFound as notFoundResolution,
} from "@/lib/resolvers/resolution";

import EntryPage from "./page";

// A fake resolvable module whose Experience marks itself, so a mounted brand slot is
// unambiguously detectable in the rendered tree.
const foundExperience = () =>
  found(async () => ({
    default: {
      Experience: () => <div data-testid="experience">experience slot</div>,
    },
  }));

interface EntryOverrides {
  [key: string]: unknown;
}

function entry(over: EntryOverrides = {}): Record<string, unknown> {
  return {
    _id: "e1",
    title: "An Entry",
    slug: "an-entry",
    kind: "note",
    blurb: "A blurb.",
    brandColor: null,
    fontKey: null,
    componentKey: null,
    body: null,
    related: null,
    backlinks: null,
    ...over,
  };
}

const params = (slug: string) => Promise.resolve({ slug });

beforeEach(() => {
  vi.clearAllMocks();
  resolveComponentKeyMock.mockReturnValue(notFoundResolution("component", "x"));
});

describe("EntryPage — kind-aware detail", () => {
  it("renders a note prose-only: title + blurb, and NO brand slot", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: null }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("A blurb.")).toBeInTheDocument();
    // No interactive project slot for a non-project.
    expect(container.querySelector("[data-project]")).toBeNull();
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
  });

  it("does NOT mount a brand slot on a note that happens to carry a resolvable componentKey", async () => {
    // The schema makes `componentKey` a plain string, optional on a note/essay — so an
    // author CAN set one. The page's stated contract: only a `project` mounts the brand
    // slot; a note/essay/now is prose-only. This asserts that contract.
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "first-light" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(container.querySelector("[data-project]")).toBeNull();
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
  });

  it("notFound()s a project whose componentKey does not resolve", async () => {
    resolveComponentKeyMock.mockReturnValue(
      notFoundResolution("component", "deleted-module"),
    );
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "project", componentKey: "deleted-module" }),
    );
    await expect(EntryPage({ params: params("an-entry") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("notFound()s a project with NO componentKey at all", async () => {
    resolveComponentKeyMock.mockReturnValue(
      notFoundResolution("component", ""),
    );
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "project", componentKey: null }),
    );
    await expect(EntryPage({ params: params("an-entry") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("notFound()s an unknown / unpublished slug (null doc)", async () => {
    fetchMock.mockResolvedValueOnce(null);
    await expect(EntryPage({ params: params("ghost") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("mounts the brand slot for a project with a resolvable componentKey", async () => {
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "project",
        componentKey: "first-light",
        brandColor: "oklch(0.7 0.15 70)",
        fontKey: "newsreader",
        slug: "first-light",
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("first-light") }),
    );
    const slot = container.querySelector("[data-project]");
    expect(slot).not.toBeNull();
    expect(screen.getByTestId("experience")).toBeInTheDocument();
  });
});
