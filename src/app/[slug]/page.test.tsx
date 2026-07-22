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

// `generateStaticParams` dynamically imports next/cache for `cacheLife`, which throws outside
// a real "use cache" scope — mock it so the enumeration logic is testable.
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

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
import { client } from "@/sanity/lib/client";

import {
  readModuleCss,
  referencedCustomProperties,
  ruleDeclarations,
} from "../../../tests/cssModule";

import EntryPage, { generateMetadata, generateStaticParams } from "./page";
import pageStyles from "./page.module.css";

const clientFetchMock = vi.mocked(client.fetch);

const accentOf = (seed: unknown): string =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

// Fake resolvable modules whose members mark themselves, so a mounted surface is
// unambiguously detectable in the rendered tree.
const foundCanvas = () =>
  found(async () => ({
    default: {
      Canvas: ({ slug }: { slug: string }) => (
        <div data-testid="canvas" data-slug={slug}>
          canvas content
        </div>
      ),
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

// A full demo module — Provider frame + Sidebar controls + Canvas surface.
const foundFullDemo = () =>
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
      Sidebar: ({ slug }: { slug: string }) => (
        <div data-testid="sidebar-controls" data-slug={slug}>
          controls
        </div>
      ),
      Canvas: ({ slug }: { slug: string }) => (
        <div data-testid="canvas" data-slug={slug}>
          canvas content
        </div>
      ),
    },
  }));

// A module that RESOLVES (`found`) but whose default export is malformed — no mountable
// member. The compile-time union forbids this, but drift/bad data can produce it at runtime;
// the editorial page must degrade to prose-only, never crash, never 404.
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
    stage: null,
    tended: null,
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

describe("EntryPage — the editorial template (note · essay · now)", () => {
  it("renders a bare note prose-only: title + summary, NO scope threaded", async () => {
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
    expect(container.querySelector("[data-entry]")).toBeNull();
    expect(screen.getByTestId("essay-body")).toHaveAttribute(
      "data-has-scope",
      "no",
    );
    // No componentKey → the resolver is never even consulted.
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("threads the theme scope to the body for a themed note (its slots get their own scope)", async () => {
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
  });

  it("wraps the article in the module's Provider for an ESSAY with a resolvable componentKey", async () => {
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
    // The article (title within it) renders INSIDE the frame — children pass through.
    expect(frame.querySelector("h1")).not.toBeNull();
  });

  it("ignores a module's Canvas on an editorial kind — no canvas mounts, the article renders", async () => {
    // A Canvas-only module resolved by a NOTE: the canvas is a demo surface, so the editorial
    // template mounts nothing from it — the entry renders its prose, and the scope still
    // threads (a module counts as the capability).
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: "color-engine", ...withBody }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-entry");
  });

  it("degrades to prose-only (no crash, no 404) when a resolved module exports no member", async () => {
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
    expect(screen.queryByTestId("provider")).not.toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toBeNull();
    // The resolved (if empty) module still counts as "mounts a module", so the body scope
    // is threaded and keyed on the real slug.
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-entry");
    expect(resolveComponentKeyMock).toHaveBeenCalledTimes(1);
  });

  it("treats an EMPTY-STRING componentKey as no key (falsy): resolver never consulted, no 404, prose-only", async () => {
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
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("renders a doc with an UNRECOGNIZED kind value on the editorial template — never a crash or 404", async () => {
    // A kind the code doesn't know (drifted data, authored before its code ships) is
    // editorial by default: article intact, Provider frame mounted, scope threaded.
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "bookmark",
        componentKey: "color-engine",
        theme: { color: "oklch(0.7 0.15 70)", bodyFont: "newsreader" },
        ...withBody,
      }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("provider")).toBeInTheDocument();
    expect(screen.getByTestId("essay-body")).toHaveAttribute(
      "data-has-scope",
      "yes",
    );
  });
});

describe("EntryPage — `now` mounts modules but never its own theme (#328)", () => {
  it("mounts the module's Provider for a `now` with a resolvable componentKey", async () => {
    // The old blanket `now` exclusion is gone: a now update can hold interactive slots.
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "now", componentKey: "color-engine", ...withBody }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(screen.getByTestId("provider")).toBeInTheDocument();
    expect(resolveComponentKeyMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the Now theme's type: a now's scope carries the slug but NONE of the doc's authored fonts", async () => {
    // `now` wears the shared `/now` seed (query rung) — the doc's own theme, even when
    // authored, never applies. Its slots mount slug-keyed with the Now theme's faces.
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "now",
        componentKey: "color-engine",
        theme: {
          color: "oklch(0.7 0.15 70)",
          headingFont: "fraunces",
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
    expect(body).toHaveAttribute("data-scope-heading", "");
    expect(body).toHaveAttribute("data-scope-body", "");
    expect(body).toHaveAttribute("data-scope-mono", "");
  });

  it("builds NO scope for a themed now without a module (its theme never counts as the capability)", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "now",
        componentKey: null,
        theme: { color: "oklch(0.7 0.15 70)", bodyFont: "newsreader" },
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

describe("EntryPage — the demo template (sidebar + canvas)", () => {
  const demoEntry = (over: EntryOverrides = {}) =>
    entry({
      kind: "demo",
      componentKey: "color-engine",
      slug: "color-engine",
      stage: "budding",
      tended: "2026-07-16",
      themeSeed: "oklch(0.7 0.15 70)",
      related: [
        { _id: "r1", title: "A related note", slug: "related", kind: "note" },
      ],
      backlinks: null,
      ...over,
    });

  it("renders sidebar + canvas: entry info, module controls, canvas — and NO prose article", async () => {
    resolveComponentKeyMock.mockReturnValue(foundFullDemo());
    fetchMock.mockResolvedValueOnce(demoEntry());
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    // The page-owned sidebar info: h1 title, summary, and the meta readout facts.
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("A summary.")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByText("Budding")).toBeInTheDocument();
    expect(screen.getByText(/Tended July 16, 2026/)).toBeInTheDocument();
    expect(screen.getByText("oklch(0.7 0.15 70)")).toBeInTheDocument();
    // The module's two surfaces, both slug-keyed.
    expect(screen.getByTestId("sidebar-controls")).toHaveAttribute(
      "data-slug",
      "color-engine",
    );
    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-slug",
      "color-engine",
    );
    // No prose article, no EntryBody — a demo has no body.
    expect(container.querySelector("article")).toBeNull();
    expect(screen.queryByTestId("essay-body")).not.toBeInTheDocument();
    // Related still renders below the demo (shared across both templates).
    expect(
      screen.getByRole("region", { name: /related/i }),
    ).toBeInTheDocument();
  });

  it("wraps the WHOLE demo surface — controls and canvas — in one slug-keyed theme scope, inside the Provider frame", async () => {
    resolveComponentKeyMock.mockReturnValue(foundFullDemo());
    fetchMock.mockResolvedValueOnce(demoEntry());
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    const scope = container.querySelector("[data-entry]");
    expect(scope).toHaveAttribute("data-entry", "color-engine");
    // Both module surfaces sit INSIDE the one scope.
    expect(
      scope?.querySelector('[data-testid="sidebar-controls"]'),
    ).not.toBeNull();
    expect(scope?.querySelector('[data-testid="canvas"]')).not.toBeNull();
    // The Provider frame wraps the scoped surface (state around theme, never inside it).
    const frame = screen.getByTestId("provider");
    expect(frame).toHaveAttribute("data-slug", "color-engine");
    expect(frame.querySelector("[data-entry]")).not.toBeNull();
  });

  it("mounts a Canvas-only demo module without controls (no Sidebar, no Provider — still a demo)", async () => {
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(demoEntry());
    render(await EntryPage({ params: params("color-engine") }));
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-controls")).not.toBeInTheDocument();
    expect(screen.queryByTestId("provider")).not.toBeInTheDocument();
  });

  it("notFound()s a demo whose resolved module lacks a Canvas (drift, same as an unresolvable key)", async () => {
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(demoEntry());
    await expect(EntryPage({ params: params("color-engine") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("renders a demo with NO componentKey on the editorial template, prose-only (a seedling, no module yet)", async () => {
    fetchMock.mockResolvedValueOnce(
      demoEntry({ componentKey: null, summary: "A seedling summary." }),
    );
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /an entry/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("A seedling summary.")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).not.toBeInTheDocument();
    expect(container.querySelector("article")).not.toBeNull();
    expect(resolveComponentKeyMock).not.toHaveBeenCalled();
  });

  it("never renders a leftover body on the demo template (the summary is the demo's prose)", async () => {
    // A demo doc that still carries a body (stale data) must not smuggle prose into the
    // sidebar+canvas template.
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(demoEntry(withBody));
    render(await EntryPage({ params: params("color-engine") }));
    expect(screen.queryByTestId("essay-body")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("never throws on a hostile theme.color through the REAL EntryScope, and keys the scope on the real slug", async () => {
    // The keystone contract at the PAGE seam: a garbage `theme.color` reaching the real
    // `EntryScope` → `resolveScope` → OKLCH engine must degrade to the fallback palette, never
    // throw. The demo template is where the page itself mounts the real scope.
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(
      demoEntry({
        theme: { color: 'javascript:alert(1)"]{}body{display:none}' },
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(container.querySelector("[data-entry]")).toHaveAttribute(
      "data-entry",
      "color-engine",
    );
  });
});

describe("EntryPage — shared gates (both templates)", () => {
  it.each(["demo", "note", "essay", "now"])(
    "notFound()s a %s whose declared componentKey does not resolve (drift, for EVERY kind)",
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

  it("notFound()s an unknown / unpublished slug (null doc)", async () => {
    fetchMock.mockResolvedValueOnce(null);
    await expect(EntryPage({ params: params("ghost") })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  // #175: the entry page delivers its OWN authored theme onto `<html>` — a synchronous
  // `<PageTheme>` mounted first in BOTH templates, baking the kind-gated `themeSeed`'s
  // engine-solved `--accent` into the parse-time init script (the same seed the chrome inherits).
  it("mounts PageTheme carrying the entry's themeSeed (editorial)", async () => {
    const SEED = "oklch(0.62 0.2 265)";
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: null, themeSeed: SEED, ...withBody }),
    );
    const html = renderToStaticMarkup(
      await EntryPage({ params: params("an-entry") }),
    );
    expect(html).toContain(accentOf(SEED));
  });

  it("mounts PageTheme carrying the entry's themeSeed (demo)", async () => {
    const SEED = "oklch(0.62 0.2 265)";
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "demo",
        componentKey: "color-engine",
        slug: "color-engine",
        themeSeed: SEED,
      }),
    );
    const html = renderToStaticMarkup(
      await EntryPage({ params: params("color-engine") }),
    );
    expect(html).toContain(accentOf(SEED));
  });

  it("mounts a module-only entry whose theme is NULL entirely: scope keyed on the REAL slug, empty font seed", async () => {
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        componentKey: "color-engine",
        theme: null,
        ...withBody,
      }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    const body = screen.getByTestId("essay-body");
    expect(body).toHaveAttribute("data-has-scope", "yes");
    expect(body).toHaveAttribute("data-scope-slug", "an-entry");
    expect(body).toHaveAttribute("data-scope-heading", "");
    expect(body).toHaveAttribute("data-scope-body", "");
    expect(body).toHaveAttribute("data-scope-mono", "");
  });

  it("treats an EMPTY-STRING theme.color as unthemed (falsy gate): no scope without a module", async () => {
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

  it("does NOT build a scope for a lone theme.bodyFont (no theme.color, no module)", async () => {
    // CHARACTERIZATION: the scope gate is `theme.color || module` — a font alone has no
    // surface to apply to, so it is silently dropped (deliberate; slots-only theming).
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

  it("renders an entry with NO body cleanly — the article still mounts its header, no EntryBody", async () => {
    resolveComponentKeyMock.mockReturnValue(foundProvider());
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "essay", componentKey: "color-engine", body: null }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    expect(article?.querySelector("h1")).not.toBeNull();
    expect(screen.queryByTestId("essay-body")).not.toBeInTheDocument();
  });

  it("renders NO Tags region even if the fetched entry carries a stray `tags` array", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({ kind: "note", componentKey: null, tags: ["stale", "leftover"] }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(
      screen.queryByRole("region", { name: /tags/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
  });
});

// QA (#329) — the editorial header's meta readout was the slice's headline (the editorial
// detail previously showed NO meta) and had no page-level coverage; nor did the page-computed
// linkCount (distinctNeighbors over the SAME arrays RelatedEntries renders).
describe("EntryPage — the meta readout on the detail surfaces (#329 QA)", () => {
  const neighbor = (id: string, over: Record<string, unknown> = {}) => ({
    _id: id,
    title: `Neighbor ${id}`,
    slug: id,
    kind: "note",
    ...over,
  });

  it("renders the FULL readout in the editorial header: kind · stage · tended · seed · N linked", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "essay",
        stage: "evergreen",
        tended: "2026-07-01",
        themeSeed: "oklch(0.66 0.2 350)",
        related: [neighbor("a")],
        backlinks: [neighbor("b")],
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    const header = container.querySelector("header");
    expect(header?.textContent).toContain("Essay");
    expect(header?.textContent).toContain("Evergreen");
    expect(header?.textContent).toContain("oklch(0.66 0.2 350)");
    expect(header?.textContent).toContain("2 Linked");
    const time = screen.getByText("Tended July 1, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-07-01");
  });

  it("editorial header hint EQUALS the rendered Related list — self/dangling/duplicate wash out of both", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        related: [
          neighbor("e1"), // self (entry._id is "e1") — dropped
          null, // dangling reference — dropped
          neighbor("a"),
          neighbor("a"), // duplicate within the arm — dropped
        ],
        backlinks: [neighbor("a"), neighbor("b")], // "a" duplicates across arms — dropped
      }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(screen.getByText("2 Linked")).toBeInTheDocument();
    const relatedList = screen
      .getByRole("heading", { name: /related/i })
      .closest("aside, section, nav, div")
      ?.querySelectorAll("li");
    expect(relatedList).toHaveLength(2);
  });

  it("renders NO stray hint when every edge washes out (self + dangling only)", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "note",
        stage: "seedling",
        related: [neighbor("e1"), null],
        backlinks: null,
      }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(screen.queryByText(/linked/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /related/i }),
    ).not.toBeInTheDocument();
  });

  it("threads the page-computed linkCount into the DEMO sidebar readout too", async () => {
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: "demo",
        componentKey: "color-engine",
        stage: "budding",
        related: [neighbor("a")],
        backlinks: [neighbor("a"), neighbor("b"), neighbor("c")],
      }),
    );
    render(await EntryPage({ params: params("an-entry") }));
    expect(screen.getByText("3 Linked")).toBeInTheDocument();
  });

  it("the editorial header omits absent facts without stray separators (kindless drifted doc, no meta at all)", async () => {
    fetchMock.mockResolvedValueOnce(
      entry({
        kind: null,
        stage: null,
        tended: null,
        themeSeed: null,
        related: null,
        backlinks: null,
      }),
    );
    const { container } = render(
      await EntryPage({ params: params("an-entry") }),
    );
    const header = container.querySelector("article header");
    expect(header?.textContent).not.toContain("·");
    expect(header?.querySelector('[data-variant="meta"]')).toBeNull();
  });
});

// QA — the demo template's remaining data edges, and the structural chain the demo CSS
// depends on (`.demoBleed > [data-entry]` is a DIRECT-child selector).
describe("EntryPage — demo template edges (QA)", () => {
  const demoEntry = (over: EntryOverrides = {}) =>
    entry({
      kind: "demo",
      componentKey: "color-engine",
      slug: "color-engine",
      stage: "budding",
      themeSeed: "oklch(0.7 0.15 70)",
      ...over,
    });

  it("drops the tended stamp (no <time>, no crash) when the authored date is malformed", async () => {
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(demoEntry({ tended: "2026-99-99" }));
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
    expect(screen.queryByText(/tended/)).not.toBeInTheDocument();
  });

  it("falls back to 'Untitled entry' for a demo whose title drifted to null", async () => {
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(demoEntry({ title: null }));
    render(await EntryPage({ params: params("color-engine") }));
    expect(
      screen.getByRole("heading", { level: 1, name: /untitled entry/i }),
    ).toBeInTheDocument();
  });

  it("keeps [data-entry] a DIRECT child of the bleed wrapper when the module has no Provider", async () => {
    // The stretch chain in page.module.css is `.demoBleed > [data-entry]` — a direct-child
    // selector. With no Provider (the shipped color-engine shape) the scope container must sit
    // immediately under the bleed wrapper, or the demo surface silently loses its full-height
    // stretch. NOTE: a module whose Provider renders a real DOM element would break this chain
    // — nothing enforces that a Provider is markup-free (see QA report).
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(demoEntry());
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    expect(
      container.querySelector(`.${pageStyles.demoBleed} > [data-entry]`),
    ).not.toBeNull();
  });

  it("mounts the demo surface inside the bleed wrapper which is a DIRECT child of the page grid", async () => {
    // grid-column only places DIRECT children — if anything wraps .demoBleed, its `full` lane
    // declaration goes inert and the demo quietly falls into the prose lane.
    resolveComponentKeyMock.mockReturnValue(foundCanvas());
    fetchMock.mockResolvedValueOnce(demoEntry());
    const { container } = render(
      await EntryPage({ params: params("color-engine") }),
    );
    expect(
      container.querySelector(`main > .${pageStyles.demoBleed}`),
    ).not.toBeNull();
  });
});

describe("generateMetadata (QA)", () => {
  it("returns the not-found title for an unknown slug instead of leaking a stale one", async () => {
    fetchMock.mockResolvedValueOnce(null);
    expect(await generateMetadata({ params: params("ghost") })).toEqual({
      title: "Not found",
    });
  });

  it("falls back to 'Untitled entry' and omits the description when both drifted to null", async () => {
    fetchMock.mockResolvedValueOnce(entry({ title: null, summary: null }));
    const meta = await generateMetadata({ params: params("an-entry") });
    expect(meta.title).toBe("Untitled entry");
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph).toMatchObject({
      title: "Untitled entry",
      type: "article",
    });
  });

  it("carries the entry's title + summary into the page and OpenGraph metadata", async () => {
    fetchMock.mockResolvedValueOnce(entry());
    const meta = await generateMetadata({ params: params("an-entry") });
    expect(meta.title).toBe("An Entry");
    expect(meta.description).toBe("A summary.");
    expect(meta.openGraph).toMatchObject({
      title: "An Entry",
      description: "A summary.",
      type: "article",
    });
  });
});

describe("generateStaticParams (QA)", () => {
  it("drops null/non-string slugs from the prerender set instead of emitting bad params", async () => {
    clientFetchMock.mockResolvedValueOnce([
      { slug: "a-real-entry" },
      { slug: null },
      { slug: 42 },
      {},
      { slug: "another" },
    ] as never);
    expect(await generateStaticParams()).toEqual([
      { slug: "a-real-entry" },
      { slug: "another" },
    ]);
  });

  it("returns an empty set (not a crash) when no entries are published", async () => {
    clientFetchMock.mockResolvedValueOnce([] as never);
    expect(await generateStaticParams()).toEqual([]);
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

describe("the entry page's heading ink rule (CSS source)", () => {
  // ALL headings are neutral ink — the entry h1 included (owner ruling 2026-07-20: the
  // display moment is type-borne — the editorial face itself — so headings spend no color).
  // The rule was applied by DELETING `color` declarations — a deletion leaves
  // nothing behind to assert, so re-adding accent to a body h2 would otherwise be invisible
  // to every rendering test (jsdom loads no stylesheets). Pinned at the CSS source via the
  // repo's postcss helpers — a commented-out declaration is NOT a live one.
  const ARTICLE_CSS = readModuleCss("src/app/[slug]/page.module.css");

  it("the body's h2/h3 rule declares no color at all", () => {
    const decls = ruleDeclarations(ARTICLE_CSS, ".article > :is(h2, h3)");
    // Assert the rule still EXISTS (a renamed selector would also yield an empty map) …
    expect(decls.size).toBeGreaterThan(0);
    // … and that ink is not among its declarations: the headings inherit the editorial ink.
    expect(decls.has("color")).toBe(false);
  });

  it("the module references no accent ink anywhere", () => {
    // Broader than the single rule above: catches the accent creeping back in on a sibling
    // selector (`.article h4`, a `:first-of-type`, a media query) rather than the pinned one.
    const vars = referencedCustomProperties(ARTICLE_CSS);
    expect([...vars].filter((v) => v.includes("accent"))).toEqual([]);
  });

  it("spends no color on the entry h1 — neutral ink, no color prop", () => {
    // The former accent-text display exception is revoked; a re-added color prop on either
    // entry h1 mount has to change this test, not just a line.
    for (const file of [
      "src/app/[slug]/page.tsx",
      "src/components/entry/DemoLayout.tsx",
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      const h1Mounts = source.match(/<Heading level=\{1\}[^>]*/g) ?? [];
      expect(h1Mounts.length, `${file} mounts an h1`).toBeGreaterThan(0);
      for (const mount of h1Mounts) {
        expect(mount, `${file} h1 must carry no color prop`).not.toContain(
          "color=",
        );
      }
    }
  });
});
