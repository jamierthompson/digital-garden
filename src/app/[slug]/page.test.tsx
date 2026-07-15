import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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

// Mock EntryBody to CAPTURE the `scope` seed the page threads to the body. The real
// serializer's `slot` → SlotBlock path is async and jsdom-untestable (async RSC), so
// the theming contract we assert HERE is "does the page hand the body the right scope?" — the
// rendered scoped slot itself is the integration test's / browser check's job.
vi.mock("@/components/portable-text/EntryBody", () => ({
  default: ({
    scope,
  }: {
    scope?: {
      slug: string;
      headingFont?: string;
      bodyFont?: string;
      monoFont?: string;
    };
  }) => (
    <div
      data-testid="essay-body"
      data-has-scope={scope ? "yes" : "no"}
      data-scope-slug={scope?.slug ?? ""}
      data-scope-heading={scope?.headingFont ?? ""}
      data-scope-body={scope?.bodyFont ?? ""}
      data-scope-mono={scope?.monoFont ?? ""}
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

// Fake resolvable modules whose members mark themselves, so a mounted themed slot / frame
// is unambiguously detectable in the rendered tree.
const foundSlot = () =>
  found(async () => ({
    default: {
      Slot: () => <div data-testid="slot">slot content</div>,
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
// `Slot`. The `EntryModule` type permits "one or both"; this exercises "both".
const foundBoth = () =>
  found(async () => ({
    default: {
      Slot: () => <div data-testid="slot">slot content</div>,
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
// neither `Slot` nor `Provider`. The compile-time union forbids this, but drift/bad
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
    summary: "A summary.",
    theme: {
      color: null,
      colorDark: null,
      headingFont: null,
      bodyFont: null,
      monoFont: null,
    },
    componentKey: null,
    // The kind-gated seed the page themes from (query-resolved: `now`→/now seed, else theme.color).
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
  it("renders a bare note prose-only: title + summary, NO themed slot, NO scope threaded", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: null, ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("A summary.")).toBeInTheDocument();
    // No interactive slot, and the body was handed no scope (unthemed slots).
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.queryByTestId("slot")).not.toBeInTheDocument();
    expect(screen.getByTestId("essay-body")).toHaveAttribute(
      "data-has-scope",
      "no",
    );
    // No componentKey → the resolver is never even consulted.
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("threads the theme scope to the body for a themed note (its slots get their own scope)", async () => {
    // Theming is a CAPABILITY: a `theme.color` on ANY kind but `now` builds the seed and hands
    // it to the body, so each `slot` mounts in its own scoped container — exactly as a
    // demo's do. No componentKey here → no after-prose `Slot`, prose + scoped slots.
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: null,
        theme: {
          color: "oklch(0.7 0.15 70)",
          headingFont: "space-grotesk",
          bodyFont: "newsreader",
          monoFont: "inter",
        },
        ...withBody,
      }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-entry");
    // The scope carries all three of the entry's role fonts — color is on `<html>`, inherited
    // by the slots.
    expect(body).toHaveAttribute("data-scope-heading", "space-grotesk");
    expect(body).toHaveAttribute("data-scope-body", "newsreader");
    expect(body).toHaveAttribute("data-scope-mono", "inter");
    // Themed, but no module → no after-prose interactive slot.
    expect(screen.queryByTestId("slot")).not.toBeInTheDocument();
  });

  it("mounts the module for a NOTE with a resolvable componentKey (capability, not kind)", async () => {
    // The NEW contract: a note that DECLARES a resolvable componentKey mounts its module —
    // kind no longer gates the slot. This is the case the old `kind === "project"` gate wrongly
    // denied.
    resolveComponentKeyMock.mockReturnValue(foundSlot());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "color-engine" }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(screen.getByTestId("slot")).toBeInTheDocument();
    // The scope is built even WITHOUT a theme.color (module present), and keyed on the REAL
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
        componentKey: "color-engine",
        slug: "an-essay",
      }),
    );
    render(await EntryPage({ params: params("an-essay") }));
    const frame = screen.getByTestId("provider");
    expect(frame).toHaveAttribute("data-slug", "an-essay");
    expect(frame.querySelector("h1")).not.toBeNull();
  });

  it("never themes and never mounts a `now`, even carrying a theme + a resolvable componentKey", async () => {
    // `now` is the ONE excluded kind — an editorial status update, never a slot. Even a doc
    // that carries BOTH capability fields renders chrome + prose: no module resolved, no scope.
    resolveComponentKeyMock.mockReturnValue(foundSlot());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "now",
        componentKey: "color-engine",
        theme: { color: "oklch(0.7 0.15 70)", bodyFont: "newsreader" },
        ...withBody,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(screen.queryByTestId("slot")).not.toBeInTheDocument();
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

  it.each(["demo", "note", "essay"])(
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

  it("renders a demo with NO componentKey prose-only (a sketch, no module yet)", async () => {
    // A `stage: sketch` demo carries a theme.color but no coded module, so its detail page
    // renders title + summary like a note/essay — it must NOT 404, and it mounts no after-prose
    // slot (nothing resolves the key it doesn't have).
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "demo",
        componentKey: null,
        summary: "A sketch summary.",
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("A sketch summary.")).toBeInTheDocument();
    expect(screen.queryByTestId("slot")).not.toBeInTheDocument();
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
    const html = renderToStaticMarkup(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(html).toContain(accentOf(SEED));
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

  // ── ONE editorial template for every entry. A `demo` with a resolved `Slot` gets
  // no special "canvas" template (the canvas concept was dropped, #211): the module's slot
  // mounts after the prose, alongside the article, its heading, and RelatedEntries — the same
  // composition every kind gets. `kind === "demo"` becomes multi-page separately (#149).

  it("renders a demo with a resolvable Slot on the editorial template — article, h1, the Slot, and RelatedEntries all present", async () => {
    resolveComponentKeyMock.mockReturnValue(foundSlot());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "demo",
        componentKey: "color-engine",
        theme: { color: "oklch(0.7 0.15 70)", bodyFont: "newsreader" },
        slug: "color-engine",
        related: [
          { _id: "r1", title: "A related note", slug: "related", kind: "note" },
        ],
        backlinks: [
          { _id: "b1", title: "A backlink", slug: "backlink", kind: "note" },
        ],
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    const main = container.querySelector("main")!;
    // One template: no canvas marker, and the editorial article + its single h1 render.
    expect(main).not.toHaveAttribute("data-template");
    expect(container.querySelector("article")).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    // The Slot mounts after the prose in its own real-slug theme scope, wrapped in a
    // <div> that is a direct child of main (so it gets the reading-measure cap).
    expect(screen.getByTestId("slot")).toBeInTheDocument();
    const slot = container.querySelector("[data-entry]");
    expect(slot).toHaveAttribute("data-entry", "color-engine");
    const wrapper = [...main.children].find((child) =>
      child.querySelector('[data-testid="slot"]'),
    );
    expect(wrapper).toBeDefined();
    // RelatedEntries renders for the demo — the canvas template no longer suppresses it.
    expect(
      screen.getByRole("region", { name: /related/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("A backlink")).toBeInTheDocument();
  });

  it("wraps the article in the module's Provider when it exports one (no after-prose slot)", async () => {
    // The #131 composition: a Provider-only module gets a client frame AROUND the
    // article (so interleaved slot blocks share state) and mounts NO monolithic
    // Slot after the prose. The frame is state-only — it must not introduce a
    // theme scope of its own (each slot brings its own scoped container).
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "demo",
        componentKey: "color-engine",
        theme: { color: "oklch(0.7 0.15 70)", bodyFont: "newsreader" },
        slug: "color-engine",
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    const frame = screen.getByTestId("provider");
    expect(frame).toHaveAttribute("data-slug", "color-engine");
    // The article (title within it) renders INSIDE the frame — children pass through.
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(frame.querySelector("h1")).not.toBeNull();
    // No monolithic slot, no page-level theme scope from the frame itself.
    expect(screen.queryByTestId("slot")).not.toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toBeNull();
  });

  // ── QA additions: edge / boundary / error cases the capability grid skipped ──

  it("mounts BOTH the Provider frame AND the after-prose Slot when a module exports both", async () => {
    // The `EntryModule` union allows "one OR both" composition members. When a module exports
    // both, the article renders INSIDE the Provider frame AND a separate `Slot` mounts
    // after the prose inside its own `[data-entry]` scope. Pins the both-present composition the
    // suite otherwise never exercises — a mutation that dropped either half would slip through.
    resolveComponentKeyMock.mockReturnValue(foundBoth());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: "color-engine",
        theme: { color: "oklch(0.7 0.15 70)" },
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
    // `Slot` present AND inside its own real-slug scope (not `fallback`).
    const slot = container.querySelector("[data-entry]");
    expect(slot).toHaveAttribute("data-entry", "an-entry");
    expect(slot?.querySelector('[data-testid="slot"]')).not.toBeNull();
  });

  it("degrades to prose-only (no slot, no crash, no 404) when a resolved module exports neither member", async () => {
    // Drift-in-the-loader: the key RESOLVES (`found`), so the drift-404 guard does not fire, but
    // the loaded default is malformed — neither `Slot` nor `Provider`. The page must render
    // the article and mount nothing, rather than throw. `entryModule` is a truthy `{}`, so the
    // scope is still built and threaded to the body (theming survives a slot-less module).
    resolveComponentKeyMock.mockReturnValue(foundEmptyModule());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "color-engine", ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("slot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("provider")).not.toBeInTheDocument();
    // No visible slot (Slot null → EntryScope not rendered), so no page-level scope div…
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
    expect(screen.queryByTestId("slot")).not.toBeInTheDocument();
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("never throws on a hostile theme.color threaded through the REAL EntryScope, and still keys the slot on the real slug", async () => {
    // The keystone contract at the PAGE seam: a garbage `theme.color` reaching the real
    // `EntryScope` → `resolveScope` → OKLCH engine must degrade to the fallback palette, never
    // throw, and the slot stays keyed on the vetted real slug (injection-safe). Uses a
    // resolvable Slot so the real EntryScope actually mounts (not the mocked EntryBody).
    resolveComponentKeyMock.mockReturnValue(foundSlot());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: "color-engine",
        theme: { color: 'javascript:alert(1)"]{}body{display:none}' },
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    // Rendered without throwing; the slot is present and keyed on the sanitized real slug.
    expect(screen.getByTestId("slot")).toBeInTheDocument();
    const slot = container.querySelector("[data-entry]");
    expect(slot).toHaveAttribute("data-entry", "an-entry");
  });

  it("threads the theme scope to the body under a Provider frame (a themed essay's slots are scoped even though the frame is not)", async () => {
    // A Provider-only module frames the article for shared state but introduces NO page-level
    // scope of its own (#131). A themed essay must still hand its `theme.color` scope to the body
    // so each interleaved `slot` mounts in its own scoped container. Pins scope-threading on
    // the Provider path — the existing Provider test carries no body, so it never checks this.
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "essay",
        componentKey: "color-engine",
        theme: { color: "oklch(0.7 0.15 70)", bodyFont: "newsreader" },
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
    // …but the body was handed the font scope for its slots.
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-essay");
    expect(body).toHaveAttribute("data-scope-body", "newsreader");
  });

  it("does NOT build a scope for a lone theme.bodyFont (no theme.color, no module) — a font alone has no slot to apply to", async () => {
    // CHARACTERIZATION of the current capability gate: the scope is built on `theme.color ||
    // module` only, so a `theme.bodyFont` set WITHOUT a theme.color or a module is silently dropped —
    // the body gets no scope and no `[data-entry]` mounts. This is a deliberate consequence of
    // "the theme is scoped to the slot, never the prose", but it means font-only theming of a note's
    // slots is a NON-feature today. If that intent ever matters, the gate must add `theme.bodyFont`.
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: null,
        theme: { color: null, bodyFont: "newsreader" },
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

  // ── QA additions (#249): the nullable `theme` OBJECT itself (not just null leaves) ──

  it("mounts a module-only entry whose theme is NULL entirely: scope keyed on the REAL slug, empty font seed", async () => {
    // ENTRY_DETAIL_QUERY types `theme` as `{...} | null` — a doc with no theme object at all
    // (e.g. a module-only note) hands the page `theme: null`, not `{ color: null }`. The gate
    // reads `entry.theme?.color` / `entry.theme?.bodyFont ?? ""`, so the scope must still build
    // (module present), key on the real slug — never `fallback` — and seed an empty font.
    resolveComponentKeyMock.mockReturnValue(foundSlot());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: "color-engine",
        theme: null,
        ...withBody,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(screen.getByTestId("slot")).toBeInTheDocument();
    const slot = container.querySelector("[data-entry]");
    expect(slot).toHaveAttribute("data-entry", "an-entry");
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    // No theme object → every role font seed is empty (undefined → ""), so the slot inherits.
    expect(body).toHaveAttribute("data-scope-heading", "");
    expect(body).toHaveAttribute("data-scope-body", "");
    expect(body).toHaveAttribute("data-scope-mono", "");
  });

  it("renders a NULL-theme, module-less entry prose-only without crashing (no scope, no slot)", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "essay", componentKey: null, theme: null, ...withBody }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.getByTestId("essay-body")).toHaveAttribute(
      "data-has-scope",
      "no",
    );
  });

  it("treats an EMPTY-STRING theme.color as unthemed (falsy gate): no scope without a module", async () => {
    // "" is reachable via the API (isThemeColorString("") passes); the `entry.theme?.color ||`
    // gate must treat it as absent — no scope, no crash — mirroring the componentKey "" case.
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: null,
        theme: { color: "", colorDark: null, bodyFont: "newsreader" },
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

  it("renders an entry with NO body cleanly — a prose-less article still mounts its header, no EntryBody", async () => {
    // A body-less entry (e.g. the Color Engine's future prose-removed state, #20) must still
    // render the article and its header, and mount nothing spurious — no EntryBody, no crash.
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "demo",
        componentKey: "color-engine",
        slug: "color-engine",
        body: null,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(article?.querySelector("h1")).not.toBeNull();
    expect(screen.queryByTestId("essay-body")).not.toBeInTheDocument();
  });
});

describe("page.tsx styles.* references resolve to real classes in page.module.css", () => {
  // WHY this reads the sources instead of rendering: `test.css` is off in `vitest.config.ts`,
  // so a CSS-Module import resolves to an identity Proxy — `pageStyles.anything` returns
  // `"anything"` — and a render assertion on a class that does NOT exist in the sheet still
  // passes (a false green; in the real build a missing export is `undefined` and React drops
  // the className entirely). Reading the actual files fails on a dangling reference no matter
  // what the test-env CSS shim does.
  it("references no class the sheet does not define", () => {
    const read = (rel: string): string =>
      readFileSync(resolve(process.cwd(), "src/app/[slug]", rel), "utf8");
    const source = read("page.tsx");
    const sheet = read("page.module.css");
    const referenced = [
      ...new Set(
        [...source.matchAll(/styles\.([a-zA-Z][a-zA-Z0-9_]*)/g)].map(
          (m) => m[1],
        ),
      ),
    ];
    expect(referenced.length).toBeGreaterThan(0); // false-green guard
    const defined = new Set(
      [...sheet.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]),
    );
    expect(referenced.filter((name) => !defined.has(name))).toEqual([]);
  });
});
