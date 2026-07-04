import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/font/google is a build-time transform, untransformed under Vitest — mock the faces
// pulled in transitively via EntryScope → resolveScope → FONT_FACES (same shape as the
// integration test / EntryScope.test.tsx).
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
// importing a real, heavy entry module. `found`/`notFound` come from the real resolution
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

// Fake resolvable modules whose members mark themselves, so a mounted brand slot / frame
// is unambiguously detectable in the rendered tree.
const foundExperience = () =>
  found(async () => ({
    default: {
      Experience: () => <div data-testid="experience">experience slot</div>,
    },
  }));

const foundProvider = () =>
  found(async () => ({
    default: {
      Provider: ({
        slug,
        children,
      }: {
        slug: string;
        children: React.ReactNode;
      }) => (
        <div data-testid="provider" data-slug={slug}>
          {children}
        </div>
      ),
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
    // No interactive brand slot for a non-project.
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
  });

  it("does NOT mount a brand slot on a note that happens to carry a resolvable componentKey", async () => {
    // The schema makes `componentKey` a plain string, optional on a note/essay — so an
    // author CAN set one. The page's stated contract: only a `project` mounts the brand
    // slot; a note/essay/now is prose-only. This asserts that contract.
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "any-module" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
  });

  it("notFound()s a project whose declared componentKey does not resolve (drift)", async () => {
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

  it("renders a project with NO componentKey prose-only (a sketch, no module yet)", async () => {
    // Post-#109 contract: a `stage: sketch` project carries a brandColor but no coded
    // module, so its detail page renders title + blurb like a note/essay — it must NOT 404,
    // and it mounts no brand slot (nothing resolves the key it doesn't have).
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "project", componentKey: null, blurb: "A sketch blurb." }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("A sketch blurb.")).toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
    // The key resolver must never even be consulted when there is no componentKey.
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("notFound()s an unknown / unpublished slug (null doc)", async () => {
    fetchMock.mockResolvedValueOnce(null);
    await expect(EntryPage({ params: params("ghost") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("renders NO Tags region even if the fetched entry carries a stray `tags` array", async () => {
    // Regression guard for the tags removal (#88): the detail query no longer projects
    // `tags`, and `TagList` is gone. A live/draft doc whose field hasn't been unset could
    // still hand the page a `tags` array — the page must never render tag markup from it.
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: null, tags: ["stale", "leftover"] }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(
      screen.queryByRole("region", { name: /tags/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
    expect(screen.queryByText("leftover")).not.toBeInTheDocument();
  });

  it("mounts the brand slot for a project with a resolvable componentKey", async () => {
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "project",
        componentKey: "palette-studio",
        brandColor: "oklch(0.7 0.15 70)",
        fontKey: "newsreader",
        slug: "palette-studio",
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("palette-studio") }),
    );
    const slot = container.querySelector("[data-entry]");
    expect(slot).not.toBeNull();
    expect(screen.getByTestId("experience")).toBeInTheDocument();
  });

  it("wraps the article in the module's Provider when it exports one (no after-prose slot)", async () => {
    // The #131 composition: a Provider-only module gets a client frame AROUND the
    // article (so interleaved liveEmbed slots share state) and mounts NO monolithic
    // Experience after the prose. The frame is state-only — it must not introduce a
    // brand scope of its own (each embed brings its own scoped container).
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "project",
        componentKey: "palette-studio",
        brandColor: "oklch(0.7 0.15 70)",
        fontKey: "newsreader",
        slug: "palette-studio",
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("palette-studio") }),
    );
    const frame = screen.getByTestId("provider");
    expect(frame).toHaveAttribute("data-slug", "palette-studio");
    // The article (title within it) renders INSIDE the frame — children pass through.
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(frame.querySelector("h1")).not.toBeNull();
    // No monolithic slot, no page-level brand scope from the frame itself.
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toBeNull();
  });
});
