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

// A module that composes BOTH ways — a Provider frame around the article AND an after-prose
// Experience slot. The `EntryModule` type permits "one or both"; this exercises "both".
const foundBoth = () =>
  found(async () => ({
    default: {
      Experience: () => <div data-testid="experience">experience slot</div>,
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

// A module that RESOLVES (`found`) but whose default export is malformed — it exports
// neither `Experience` nor `Provider`. The compile-time union forbids this, but drift/bad
// data can produce it at runtime; the page must degrade to prose-only, never crash, never 404.
const foundEmptyModule = () => found(async () => ({ default: {} }));

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

  // ── QA additions: edge / boundary / error cases the capability grid skipped ──

  it("mounts BOTH the Provider frame AND the after-prose Experience slot when a module exports both", async () => {
    // The `EntryModule` union allows "one OR both" composition members. When a module exports
    // both, the article renders INSIDE the Provider frame AND a separate Experience slot mounts
    // after the prose inside its own `[data-entry]` scope. Pins the both-present composition the
    // suite otherwise never exercises — a mutation that dropped either half would slip through.
    resolveComponentKeyMock.mockReturnValue(foundBoth());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: "palette-studio",
        brandColor: "oklch(0.7 0.15 70)",
        ...withBody,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    // Article wrapped in the Provider frame (children pass-through).
    const frame = screen.getByTestId("provider");
    expect(frame).toHaveAttribute("data-slug", "an-entry");
    expect(frame.querySelector("h1")).not.toBeNull();
    // Experience slot present AND inside its own real-slug scope (not `fallback`).
    const slot = container.querySelector("[data-entry]");
    expect(slot).toHaveAttribute("data-entry", "an-entry");
    expect(slot?.querySelector('[data-testid="experience"]')).not.toBeNull();
  });

  it("degrades to prose-only (no slot, no crash, no 404) when a resolved module exports neither member", async () => {
    // Drift-in-the-loader: the key RESOLVES (`found`), so the drift-404 guard does not fire, but
    // the loaded default is malformed — neither `Experience` nor `Provider`. The page must render
    // the article and mount nothing, rather than throw. `entryModule` is a truthy `{}`, so the
    // scope is still built and threaded to the body (theming survives a slot-less module).
    resolveComponentKeyMock.mockReturnValue(foundEmptyModule());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "palette-studio", ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
    expect(screen.queryByTestId("provider")).not.toBeInTheDocument();
    // No visible slot (Experience null → EntryScope not rendered), so no page-level scope div…
    expect(container.querySelector("[data-entry]")).toBeNull();
    // …but the resolved (if empty) module still counts as "mounts a module", so the body scope
    // is threaded and keyed on the real slug.
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-entry");
    // The resolver WAS consulted (a key was declared) — just yielded a slot-less module.
    expect(resolveComponentKeyMock).toHaveBeenCalledTimes(1);
  });

  it("treats an EMPTY-STRING componentKey as no key (falsy): resolver never consulted, no 404, prose-only", async () => {
    // A Sanity string field can be present-but-empty (`""`), which is falsy. The page's
    // `entry.componentKey` guard must treat it exactly like a missing key — no resolution, no
    // drift-404, prose-only — never call the resolver with `""`.
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "", ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("never throws on a hostile brandColor threaded through the REAL EntryScope, and still keys the slot on the real slug", async () => {
    // The keystone contract at the PAGE seam: a garbage `brandColor` reaching the real
    // `EntryScope` → `resolveScope` → OKLCH engine must degrade to the fallback palette, never
    // throw, and the slot stays keyed on the vetted real slug (injection-safe). Uses a
    // resolvable Experience so the real EntryScope actually mounts (not the mocked EssayBody).
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: "palette-studio",
        brandColor: 'javascript:alert(1)"]{}body{display:none}',
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    // Rendered without throwing; the slot is present and keyed on the sanitized real slug.
    expect(screen.getByTestId("experience")).toBeInTheDocument();
    const slot = container.querySelector("[data-entry]");
    expect(slot).toHaveAttribute("data-entry", "an-entry");
  });

  it("threads the brand scope to the body under a Provider frame (a themed essay's embeds are scoped even though the frame is not)", async () => {
    // A Provider-only module frames the article for shared state but introduces NO page-level
    // scope of its own (#131). A themed essay must still hand its `brandColor` scope to the body
    // so each interleaved `liveEmbed` mounts in its own scoped container. Pins scope-threading on
    // the Provider path — the existing Provider test carries no body, so it never checks this.
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "essay",
        componentKey: "palette-studio",
        brandColor: "oklch(0.7 0.15 70)",
        fontKey: "newsreader",
        slug: "an-essay",
        ...withBody,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-essay") }),
    );
    expect(screen.getByTestId("provider")).toBeInTheDocument();
    // Frame introduces no page-level scope wrapper.
    expect(container.querySelector("[data-entry]")).toBeNull();
    // …but the body was handed the brand scope for its embeds.
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-essay");
    expect(body).toHaveAttribute("data-scope-brand", "oklch(0.7 0.15 70)");
  });

  it("does NOT build a scope for a lone fontKey (no brandColor, no module) — a fontKey alone has no slot to apply to", async () => {
    // CHARACTERIZATION of the current capability gate: the scope is built on `brandColor ||
    // module` only, so a `fontKey` set WITHOUT a brandColor or a module is silently dropped —
    // the body gets no scope and no `[data-entry]` mounts. This is a deliberate consequence of
    // "brand is scoped to the slot, never the prose", but it means font-only theming of a note's
    // embeds is a NON-feature today. If that intent ever matters, the gate must add `fontKey`.
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: null,
        brandColor: null,
        fontKey: "newsreader",
        ...withBody,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.getByTestId("essay-body")).toHaveAttribute(
      "data-has-scope",
      "no",
    );
  });
});
