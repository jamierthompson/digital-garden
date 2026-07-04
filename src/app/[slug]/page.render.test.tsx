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

// Control component-key resolution so we exercise the PAGE's capability-gating branch without
// importing a real, heavy entry module. `found`/`notFound` come from the real resolution
// module (unmocked) so `isNotFound` in the page narrows correctly.
const { resolveComponentKeyMock } = vi.hoisted(() => ({
  resolveComponentKeyMock: vi.fn(),
}));
vi.mock("@/lib/resolvers/components", () => ({
  resolveComponentKey: resolveComponentKeyMock,
}));

// Mock EssayBody to CAPTURE the `scope` seed the page threads to the body. The real
// serializer's `liveEmbed` → EmbedBlock path is async and jsdom-untestable (async RSC), so
// the theming contract we assert HERE is "does the page hand the body the right scope?" — the
// rendered scoped embed itself is the integration test's / browser check's job.
vi.mock("@/components/portable-text/EssayBody", () => ({
  default: ({
    scope,
  }: {
    scope?: { slug: string; brandColor: string; fontKey: string };
  }) => (
    <div
      data-testid="essay-body"
      data-has-scope={scope ? "yes" : "no"}
      data-scope-slug={scope?.slug ?? ""}
      data-scope-brand={scope?.brandColor ?? ""}
    />
  ),
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

// A truthy body so the (mocked) EssayBody mounts and we can read the threaded scope.
const withBody = { body: [] as unknown[] };

const params = (slug: string) => Promise.resolve({ slug });

beforeEach(() => {
  vi.clearAllMocks();
  resolveComponentKeyMock.mockReturnValue(notFoundResolution("component", "x"));
});

describe("EntryPage — capability-gated detail (kind no longer gates; capability fields do)", () => {
  it("renders a bare note prose-only: title + blurb, NO brand slot, NO scope threaded", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: null, ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("A blurb.")).toBeInTheDocument();
    // No interactive slot, and the body was handed no scope (unthemed embeds).
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
    expect(screen.getByTestId("essay-body")).toHaveAttribute(
      "data-has-scope",
      "no",
    );
    // No componentKey → the resolver is never even consulted.
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("threads the brand scope to the body for a themed note (its liveEmbeds get their own scope)", async () => {
    // Theming is a CAPABILITY: a `brandColor` on ANY kind but `now` builds the seed and hands
    // it to the body, so each `liveEmbed` mounts in its own scoped container — exactly as a
    // project's do. No componentKey here → no after-prose Experience slot, prose + scoped embeds.
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: null,
        brandColor: "oklch(0.7 0.15 70)",
        fontKey: "newsreader",
        ...withBody,
      }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-entry");
    expect(body).toHaveAttribute("data-scope-brand", "oklch(0.7 0.15 70)");
    // Themed, but no module → no after-prose interactive slot.
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
  });

  it("mounts the module for a NOTE with a resolvable componentKey (capability, not kind)", async () => {
    // The NEW contract: a note that DECLARES a resolvable componentKey mounts its module —
    // kind no longer gates the slot. This is the case the old `kind === "project"` gate wrongly
    // denied.
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "palette-studio" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(screen.getByTestId("experience")).toBeInTheDocument();
    // The scope is built even WITHOUT a brandColor (module present), and keyed on the REAL
    // slug — never the shared `data-entry="fallback"` that would cross-contaminate entries.
    const slot = container.querySelector("[data-entry]");
    expect(slot).toHaveAttribute("data-entry", "an-entry");
  });

  it("mounts the module for an ESSAY with a resolvable componentKey (Provider frame)", async () => {
    // An essay is interactive purely by capability too: a resolvable key wraps the article in
    // the module's Provider frame — no kind check involved.
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "essay",
        componentKey: "palette-studio",
        slug: "an-essay",
      }),
    );
    render(await EntryPage({ params: params("an-essay") }));
    const frame = screen.getByTestId("provider");
    expect(frame).toHaveAttribute("data-slug", "an-essay");
    expect(frame.querySelector("h1")).not.toBeNull();
  });

  it("never themes and never mounts a `now`, even carrying brandColor + a resolvable componentKey", async () => {
    // `now` is the ONE excluded kind — an editorial status update, never a slot. Even a doc
    // that carries BOTH capability fields renders chrome + prose: no module resolved, no scope.
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "now",
        componentKey: "palette-studio",
        brandColor: "oklch(0.7 0.15 70)",
        fontKey: "newsreader",
        ...withBody,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.getByTestId("essay-body")).toHaveAttribute(
      "data-has-scope",
      "no",
    );
    // The key resolver must never even be consulted for a `now`.
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("does NOT 404 a `now` whose declared componentKey is unresolvable (drift is ignored on `now`)", async () => {
    // `now` never resolves its key, so a stale/renamed componentKey on a `now` can't drift it
    // to not-found — it just renders prose-only.
    resolveComponentKeyMock.mockReturnValue(
      notFoundResolution("component", "deleted-module"),
    );
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "now", componentKey: "deleted-module" }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it.each(["project", "note", "essay"])(
    "notFound()s a %s whose declared componentKey does not resolve (drift, for ANY resolving kind)",
    async (kind) => {
      resolveComponentKeyMock.mockReturnValue(
        notFoundResolution("component", "deleted-module"),
      );
      fetchMock.mockResolvedValueOnce(
        entry({ kind, componentKey: "deleted-module" }),
      );
      await expect(EntryPage({ params: params("an-entry") })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
    },
  );

  it("renders a project with NO componentKey prose-only (a sketch, no module yet)", async () => {
    // A `stage: sketch` project carries a brandColor but no coded module, so its detail page
    // renders title + blurb like a note/essay — it must NOT 404, and it mounts no after-prose
    // slot (nothing resolves the key it doesn't have).
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
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toBeNull();
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

  it("mounts the brand slot for a project with a resolvable componentKey (existing behavior unchanged)", async () => {
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
