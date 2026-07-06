import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pageStyles from "./page.module.css";

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

// Mock EntryBody to CAPTURE the `scope` seed the page threads to the body. The real
// serializer's `liveEmbed` → EmbedBlock path is async and jsdom-untestable (async RSC), so
// the theming contract we assert HERE is "does the page hand the body the right scope?" — the
// rendered scoped embed itself is the integration test's / browser check's job.
vi.mock("@/components/portable-text/EntryBody", () => ({
  default: ({ scope }: { scope?: { slug: string; fontKey: string } }) => (
    <div
      data-testid="essay-body"
      data-has-scope={scope ? "yes" : "no"}
      data-scope-slug={scope?.slug ?? ""}
      data-scope-font={scope?.fontKey ?? ""}
    />
  ),
}));

import {
  found,
  notFound as notFoundResolution,
} from "@/lib/resolvers/resolution";
import { resolveThemeDeclarations } from "@/lib/theme";

import EntryPage from "./page";

const accentOf = (seed: unknown): string =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

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

// A PROVIDER-ONLY module that declares `layout: "wide"` (#139) — the studio's real composition
// (Provider + interleaved liveEmbed slots, NO Experience). The wide page width must apply to
// THIS shape with no recomposition: the acceptance case the owner correction turns on.
const foundWideProvider = () =>
  found(async () => ({
    default: {
      layout: "wide" as const,
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

// An Experience module that also declares `layout: "wide"` — proves the width switch is
// composition-agnostic (works for a lone Experience too, not only the Provider path).
const foundWideExperience = () =>
  found(async () => ({
    default: {
      layout: "wide" as const,
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
    brandColorDark: null,
    fontKey: null,
    componentKey: null,
    // The kind-gated seed the page themes from (query-resolved: `now`→/now seed, else brandColor).
    themeSeed: null,
    body: null,
    related: null,
    backlinks: null,
    ...over,
  };
}

// A truthy body so the (mocked) EntryBody mounts and we can read the threaded scope.
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
    // The scope carries the entry's font — color is on `<html>`, inherited by the embeds.
    expect(body).toHaveAttribute("data-scope-font", "newsreader");
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

  // #175: the entry page delivers its OWN authored theme onto `<html>` — a synchronous
  // `<PageTheme>` mounted first in BOTH templates, baking the kind-gated `themeSeed`'s
  // engine-solved `--accent` into the parse-time init script (the same seed the chrome inherits).
  it("mounts PageTheme carrying the entry's themeSeed", async () => {
    const SEED = "oklch(0.62 0.2 265)";
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: null, themeSeed: SEED, ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    const initScript = [...container.querySelectorAll("script")].find((s) =>
      s.innerHTML.includes("setProperty"),
    );
    expect(initScript?.innerHTML).toContain(accentOf(SEED));
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

  // ── #139: kind-driven CANVAS template — a `project` with a resolved `Experience` gets the
  // tool-first composition (no editorial article/title/RelatedEntries); every other case
  // (essay/note/now, or a `project` with no Experience yet) keeps the editorial template.

  it("CANVAS: a project with a resolvable Experience renders the tool-first template — no article, no RelatedEntries, `data-template='canvas'`", async () => {
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
    const main = container.querySelector("main");
    expect(main).toHaveAttribute("data-template", "canvas");
    // The bounded brand scope still mounts (same slot as the editorial template's).
    const slot = container.querySelector("[data-entry]");
    expect(slot).not.toBeNull();
    expect(slot).toHaveAttribute("data-entry", "palette-studio");
    expect(screen.getByTestId("experience")).toBeInTheDocument();
    // No editorial surfaces: no template-rendered title/blurb, no article, no related region.
    expect(container.querySelector("article")).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("A blurb.")).not.toBeInTheDocument();
  });

  it("CANVAS: does not render `<RelatedEntries>` even when the entry carries related/backlinks", async () => {
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "project",
        componentKey: "palette-studio",
        slug: "palette-studio",
        related: [
          { _id: "r1", title: "Related", slug: "related", kind: "note" },
        ],
        backlinks: [
          { _id: "b1", title: "Backlink", slug: "backlink", kind: "note" },
        ],
      }),
    );
    render(await EntryPage({ params: params("palette-studio") }));
    expect(screen.queryByText("Related")).not.toBeInTheDocument();
    expect(screen.queryByText("Backlink")).not.toBeInTheDocument();
  });

  it("does NOT canvas a `project` with a Provider-only module (no Experience) — falls back to the editorial template", async () => {
    // A Provider frames the article for shared client state; it never composes the page as a
    // canvas by itself — only a resolved `Experience` does.
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
    expect(container.querySelector("main")).not.toHaveAttribute(
      "data-template",
    );
    expect(screen.getByTestId("provider")).toBeInTheDocument();
    expect(container.querySelector("article")).not.toBeNull();
  });

  it("does NOT canvas a NOTE/ESSAY with a resolvable Experience — `kind` gates the template, not the capability", async () => {
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "palette-studio" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(container.querySelector("main")).not.toHaveAttribute(
      "data-template",
    );
    expect(screen.getByTestId("experience")).toBeInTheDocument();
    expect(container.querySelector("article")).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
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
    // resolvable Experience so the real EntryScope actually mounts (not the mocked EntryBody).
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
    // …but the body was handed the font scope for its embeds.
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-essay");
    expect(body).toHaveAttribute("data-scope-font", "newsreader");
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

  // ── #139: module-declared page WIDTH — narrow (default) vs wide ──
  //
  // The observable server-side contract is `<main data-layout>` — "narrow" (today's editorial
  // max-width) unless a resolved module declares `layout: "wide"`. jsdom computes no layout, so
  // these pin WHICH width the page selects; the actual screen-filling geometry (no horizontal
  // overflow at 390/1440/1920) is the browser check's job.

  it("defaults a prose-only entry to the narrow layout (no module → no width declaration)", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: null, ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(container.querySelector("main")).toHaveAttribute(
      "data-layout",
      "narrow",
    );
  });

  it("keeps a module that declares NO layout on the narrow default (absent === narrow; no leak)", async () => {
    // Regression: the wide option must not widen existing modules. A resolvable module with no
    // `layout` renders exactly as before — narrow page.
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "project", componentKey: "palette-studio" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(container.querySelector("main")).toHaveAttribute(
      "data-layout",
      "narrow",
    );
    expect(screen.getByTestId("experience")).toBeInTheDocument();
  });

  it('widens a PROVIDER-ONLY module that declares `layout: "wide"` — the studio\'s real shape, no Experience, no recomposition', async () => {
    // THE acceptance case: the studio composes as Provider + interleaved liveEmbed slots with no
    // monolithic Experience. `layout: "wide"` must widen the page for that shape as-is — the width
    // switch is on the page container, independent of any slot. Article still renders in the frame.
    resolveComponentKeyMock.mockReturnValue(foundWideProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "project",
        componentKey: "palette-studio",
        slug: "palette-studio",
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("palette-studio") }),
    );
    expect(container.querySelector("main")).toHaveAttribute(
      "data-layout",
      "wide",
    );
    const frame = screen.getByTestId("provider");
    expect(frame).toHaveAttribute("data-slug", "palette-studio");
    // The article (its title) still renders inside the Provider frame — the wide page did not
    // disturb the composition, only the container width.
    expect(frame.querySelector("h1")).not.toBeNull();
    // No Experience needed for the wide page to apply.
    expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
  });

  it('widens an Experience module that declares `layout: "wide"` too (composition-agnostic)', async () => {
    resolveComponentKeyMock.mockReturnValue(foundWideExperience());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "palette-studio" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(container.querySelector("main")).toHaveAttribute(
      "data-layout",
      "wide",
    );
    expect(screen.getByTestId("experience")).toBeInTheDocument();
  });

  // The MECHANISM behind the wide Experience, pinned as class composition (not just
  // `data-layout`): jsdom computes no width, so the bug — a lone Experience "reports wide but
  // renders at content width" because `.module > :not(.article)` pins its wrapper to
  // `--width-text` — is only catchable by asserting the classes the CSS rule keys off. The fix
  // wraps the Experience in a `.experience` element that is a DIRECT child of `main`, exempted
  // under `.wide` by `.wide > .experience`. Two browser paths of this class of bug (article
  // slots, then Experience) have escaped jsdom; this locks the Experience path structurally.
  it("wraps the wide Experience in a `.experience` direct-child of main that `.wide` can exempt", async () => {
    resolveComponentKeyMock.mockReturnValue(foundWideExperience());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "palette-studio" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    const main = container.querySelector("main")!;
    // Both classes the exemption selector `.wide > .experience` depends on are present…
    expect(main.className).toContain(pageStyles.module);
    expect(main.className).toContain(pageStyles.wide);
    // …on a wrapper that is a DIRECT child of main (so the `>` combinator matches).
    const wrapper = [...main.children].find((child) =>
      child.querySelector('[data-testid="experience"]'),
    );
    expect(
      wrapper,
      "Experience wrapper must be a direct child of main",
    ).toBeDefined();
    expect(wrapper!.className).toContain(pageStyles.experience);
  });

  it("keeps the same `.experience` wrapper on a NARROW Experience, without `.wide` (byte-identical narrow path)", async () => {
    resolveComponentKeyMock.mockReturnValue(foundExperience());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "palette-studio" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    const main = container.querySelector("main")!;
    // Narrow: main carries `.module` but NOT `.wide`, so the wrapper keeps the reading-measure
    // cap (`.module > :not(.article)`) — narrow entries are unchanged by the wide exemption.
    expect(main.className).toContain(pageStyles.module);
    expect(main.className).not.toContain(pageStyles.wide);
    const wrapper = [...main.children].find((child) =>
      child.querySelector('[data-testid="experience"]'),
    );
    expect(wrapper!.className).toContain(pageStyles.experience);
  });

  it("renders a wide entry with NO body cleanly — a prose-less article (the studio's future state) still mounts, no EntryBody", async () => {
    // The prose-removed studio (#20) will have `body: null`: a wide page whose article carries no
    // prose at all. The article must still render (its header) and mount nothing spurious — no
    // EntryBody, no crash — so the wide grid has a clean, header-only content column. (jsdom can't
    // measure the box; the "no collapsed/zero-height artifacts, no stray margins" property is the
    // browser check's job — this pins the structural contract.)
    resolveComponentKeyMock.mockReturnValue(foundWideProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "project",
        componentKey: "palette-studio",
        slug: "palette-studio",
        body: null,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("palette-studio") }),
    );
    expect(container.querySelector("main")).toHaveAttribute(
      "data-layout",
      "wide",
    );
    // Article present (rendered inside the Provider frame) with its header, but NO prose body.
    const frame = screen.getByTestId("provider");
    expect(frame.querySelector("article")).not.toBeNull();
    expect(frame.querySelector("h1")).not.toBeNull();
    expect(screen.queryByTestId("essay-body")).not.toBeInTheDocument();
  });

  it("never widens a `now` (excluded kind never resolves a module, so it can carry no width)", async () => {
    // `now` never consults the resolver, so even a doc pointing at a wide module stays narrow —
    // an editorial status update is always the narrow editorial page.
    resolveComponentKeyMock.mockReturnValue(foundWideProvider());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "now", componentKey: "palette-studio", ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(container.querySelector("main")).toHaveAttribute(
      "data-layout",
      "narrow",
    );
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // QA — adversarial (#139 page width): mechanism, type honesty & isolation.
  //
  // The author's 5 width tests assert ONLY `data-layout`. But `data-layout` is a
  // MARKER — the thing that actually widens the page is the `.wide` CSS class on
  // `<main>`, set from the SAME `isWide` boolean but by a SEPARATE expression (the
  // `className` ternary). A mutation that broke the className half while leaving
  // `data-layout` intact would ship a page that *reports* "wide" but *renders* narrow —
  // and every existing test would still pass. These pin the class mechanism itself, the
  // strict `=== "wide"` type gate (degrade, never emit a foreign token, never throw),
  // and per-<main> isolation under Activity.
  //
  // NOTE on CSS-module resolution under this Vitest config: `styles.<anything>` returns
  // a synthesized `_<name>_<hash>` string for ANY key access (verified empirically), so
  // these assert the className COMPOSITION (which classes the JSX puts on <main>), not
  // that the CSS itself widens — that geometry is the browser check's job.
  describe("QA — adversarial: width mechanism, type honesty & isolation", () => {
    const classesOf = (el: Element | null): string[] =>
      el ? Array.from(el.classList) : [];

    it("wide <main> carries a MODIFIER class the narrow <main> does not (pins the className half, not just data-layout)", async () => {
      // Render a narrow prose-only page and a wide Provider page and compare their <main>
      // class lists. The wide page must add EXACTLY ONE class on top of the base — the `.wide`
      // modifier. If the className ternary regressed (e.g. always `styles.module`), data-layout
      // would still say "wide" but this assertion would fail — which is the whole point.
      fetchMock.mockResolvedValueOnce(
        entry({ kind: "note", componentKey: null, ...withBody }),
      );
      const narrow = render(await EntryPage({ params: params("an-entry") }));
      const narrowClasses = classesOf(narrow.container.querySelector("main"));

      resolveComponentKeyMock.mockReturnValue(foundWideProvider());
      fetchMock.mockResolvedValueOnce(
        entry({
          kind: "project",
          componentKey: "palette-studio",
          slug: "palette-studio",
        }),
      );
      const wide = render(
        await EntryPage({ params: params("palette-studio") }),
      );
      const wideClasses = classesOf(wide.container.querySelector("main"));

      // Narrow is the single base class; wide is base + one modifier.
      expect(narrowClasses).toHaveLength(1);
      expect(wideClasses).toHaveLength(2);
      // Wide is a strict superset: it keeps the base class and adds a NEW one.
      for (const c of narrowClasses) expect(wideClasses).toContain(c);
      const modifier = wideClasses.filter((c) => !narrowClasses.includes(c));
      expect(modifier).toHaveLength(1);
      // The modifier is genuinely absent from the narrow page (no leak of the wide class).
      expect(narrowClasses).not.toContain(modifier[0]);
    });

    it("narrow <main> is EXACTLY the base class — no `.wide` modifier, no stray/empty tokens (crown-jewel: className unchanged)", async () => {
      resolveComponentKeyMock.mockReturnValue(foundExperience());
      fetchMock.mockResolvedValueOnce(
        entry({ kind: "project", componentKey: "palette-studio" }),
      );
      const { container } = render(
        await EntryPage({ params: params("an-entry") }),
      );
      const main = container.querySelector("main");
      expect(classesOf(main)).toHaveLength(1);
      // No "undefined"/empty-string tokens leaked into the class attribute.
      expect(main?.className).not.toMatch(/undefined|\s{2,}|^\s|\s$/);
    });

    it.each([
      { label: "a foreign string (banana)", layout: "banana" },
      { label: "null (bad runtime data)", layout: null },
      { label: "undefined (explicit)", layout: undefined },
      { label: "a boolean true", layout: true },
      { label: "the number 1", layout: 1 },
    ])(
      'degrades a module whose `layout` is $label to narrow — strict `=== "wide"`, never emits a foreign data-layout, never throws',
      async ({ layout }) => {
        // Type honesty at the runtime boundary: the contract says `layout?: "wide"`, but drift /
        // bad data can hand the page anything. `isWide` is a strict `=== "wide"`, so every
        // non-"wide" value must fall through to the narrow default — and data-layout must be
        // exactly "narrow", never the foreign token echoed back.
        resolveComponentKeyMock.mockReturnValue(
          found(async () => ({
            default: {
              layout,
              Experience: () => <div data-testid="experience">slot</div>,
            },
          })),
        );
        fetchMock.mockResolvedValueOnce(
          entry({ kind: "project", componentKey: "palette-studio" }),
        );
        const { container } = render(
          await EntryPage({ params: params("an-entry") }),
        );
        const main = container.querySelector("main");
        expect(main).toHaveAttribute("data-layout", "narrow");
        // The foreign token never reaches the markup.
        expect(main?.getAttribute("data-layout")).toBe("narrow");
        // …and the wide modifier class is not applied (single base class only).
        expect(classesOf(main)).toHaveLength(1);
        expect(screen.getByTestId("experience")).toBeInTheDocument();
      },
    );

    it("applies wide to a MALFORMED wide module that exports neither Experience nor Provider (drift: layout-only) — wide + prose-only, no crash, no 404", async () => {
      // The compile-time union forbids a member-less module, but drift can produce
      // `{ layout: "wide" }` at runtime. `isWide` reads `layout` independent of any slot, so the
      // page must still widen AND degrade to prose-only — never throw.
      resolveComponentKeyMock.mockReturnValue(
        found(async () => ({ default: { layout: "wide" as const } })),
      );
      fetchMock.mockResolvedValueOnce(
        entry({ kind: "project", componentKey: "palette-studio", ...withBody }),
      );
      const { container } = render(
        await EntryPage({ params: params("an-entry") }),
      );
      const main = container.querySelector("main");
      expect(main).toHaveAttribute("data-layout", "wide");
      expect(classesOf(main)).toHaveLength(2);
      // Prose-only: nothing mounted, but the article (its header) is present.
      expect(screen.queryByTestId("experience")).not.toBeInTheDocument();
      expect(screen.queryByTestId("provider")).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: /an entry/i }),
      ).toBeInTheDocument();
    });

    it("keeps two simultaneously-mounted <main>s (Activity) from bleeding width into each other, and touches nothing global", async () => {
      // Cache Components can keep several /[slug] routes mounted at once (React <Activity>).
      // Mount a WIDE entry and a NARROW entry together; each <main> must keep its own
      // data-layout + class, and NOTHING global (document.body) may be re-styled — the width
      // switch is strictly per-<main>.
      resolveComponentKeyMock.mockReturnValue(foundWideProvider());
      fetchMock.mockResolvedValueOnce(
        entry({
          kind: "project",
          componentKey: "palette-studio",
          slug: "palette-studio",
        }),
      );
      render(await EntryPage({ params: params("palette-studio") }));

      resolveComponentKeyMock.mockReturnValue(
        notFoundResolution("component", "x"),
      );
      fetchMock.mockResolvedValueOnce(
        entry({
          kind: "note",
          componentKey: null,
          slug: "a-note",
          ...withBody,
        }),
      );
      render(await EntryPage({ params: params("a-note") }));

      const mains = Array.from(document.querySelectorAll("main"));
      expect(mains).toHaveLength(2);
      const layouts = mains.map((m) => m.getAttribute("data-layout")).sort();
      expect(layouts).toEqual(["narrow", "wide"]);
      // Each main's class count matches its own mode — wide=2, narrow=1 — proving no bleed.
      const wideMain = mains.find(
        (m) => m.getAttribute("data-layout") === "wide",
      );
      const narrowMain = mains.find(
        (m) => m.getAttribute("data-layout") === "narrow",
      );
      expect(classesOf(wideMain ?? null)).toHaveLength(2);
      expect(classesOf(narrowMain ?? null)).toHaveLength(1);
      // Nothing global was touched: the body carries no data-layout and no injected class.
      expect(document.body).not.toHaveAttribute("data-layout");
      expect(document.body.classList).toHaveLength(0);
    });
  });
});

// #147 — the entry-page h1 must render in the DISPLAY face, the same way the homepage h1 does,
// via the SHARED `--font-display` token so the two can never drift. jsdom applies no CSS-module
// font-family, so the browser check proves the RENDER; this pins the CONTRACT: both `.title`
// rules bind `--font-display` (a token, never a hardcoded family).
describe("#147 — entry h1 shares the homepage display font", () => {
  /** True when the FIRST `.title { … }` rule in `cssPath` binds `font-family: var(--font-display)`. */
  function titleBindsDisplayFont(cssPath: string): boolean {
    const css = readFileSync(cssPath, "utf8");
    const rule = css.match(/\.title\s*\{([^}]*)\}/);
    return !!rule && /font-family:\s*var\(--font-display\)/.test(rule[1]);
  }

  it("binds --font-display in BOTH the homepage and the entry .title (can't drift)", () => {
    // Vitest runs from the repo root, so resolve both stylesheets relative to cwd.
    // Entry page — the fix.
    expect(titleBindsDisplayFont("src/app/[slug]/page.module.css")).toBe(true);
    // Homepage — the reference it must match.
    expect(titleBindsDisplayFont("src/app/page.module.css")).toBe(true);
  });
});
