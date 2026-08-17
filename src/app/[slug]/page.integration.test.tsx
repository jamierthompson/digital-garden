import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next/font/google is untransformed under Vitest (a build-time transform), so mock the
// faces the roster imports — loaded transitively via EntryScope → resolveScope →
// FONT_FACES. Same shape as EntryScope.test.tsx / roster.test.ts.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

// ── QA: the seams the `full`-lane chain below needs mocked. ──
// The route's single document read.
const { fetchMock, bodyHolder } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  // Lets the test hand the (stubbed) serializer a REAL, pre-awaited SlotBlock element —
  // SlotBlock is an async RSC and cannot be rendered nested inside another async tree
  // under jsdom, so it is awaited first and injected here.
  bodyHolder: { node: null as React.ReactNode },
}));
vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
// NOTE: `@/lib/resolvers/components` is deliberately NOT mocked here — the not-found test
// above exercises the real resolver. The Provider-mounted half of this chain is pinned in
// page.test.tsx, which already owns a resolver mock.
// Only the serializer is stubbed — the <article>, its grid, and the SlotBlock inside it are
// all real. That the REAL serializer emits its blocks as DIRECT children (the other half of
// this chain) is pinned in EntryBody.test.tsx.
vi.mock("@/components/portable-text/EntryBody", () => ({
  default: () => bodyHolder.node,
}));

import SlotBlock from "@/components/portable-text/SlotBlock";
import EntryScope from "@/components/entry-scope/EntryScope";
import { resolveScope } from "@/components/entry-scope/scopeSeed";
import { resolveComponentKey } from "@/lib/resolvers/components";
import { isNotFound } from "@/lib/resolvers/resolution";

// Integration test of the primary flow — Sanity document → themed slot → essay
// slot — with the Sanity fetch MOCKED so no network touches Vitest. It exercises the
// SYNCHRONOUS seams of the flow (scope resolution, scope render, the missing-slot
// fallback); the async-RSC page render itself is jsdom-untestable and is the Chrome
// DevTools MCP browser check's job / Playwright's (testing.md "Async RSCs").
//
// The fixture is a representative themed-entry doc shape — the theming/slot infrastructure
// is exercised directly here (no coded entry module or registered slot ships post-#109,
// so the full page only mounts a slot once a real module lands; the seams below are the
// durable contract, and the slot registry now resolves every key to the missing-slot seam).

const THEMED_ENTRY = {
  _id: "themed-entry-fixture",
  title: "A Themed Slot",
  slug: "themed-slot",
  summary: "A representative themed entry.",
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

  it("shows the missing-slot placeholder for an unresolved slot key (no crash)", async () => {
    const ui = await SlotBlock({ slotKey: "ghost-widget" });
    render(ui);
    expect(screen.getByText(/Slot unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/ghost-widget/)).toBeInTheDocument();
  });

  it("flags an unknown slug / componentKey as not-found (the route's notFound trigger)", () => {
    // An unpublished slug → null doc → route calls notFound(); a renamed componentKey →
    // NotFound from the resolver → route calls notFound(). Both are the typed-miss path.
    const unknownComponent = resolveComponentKey("deleted-module");
    expect(isNotFound(unknownComponent)).toBe(true);
  });
});

// ── QA (added by adversarial review of the one-template refactor) ──
//
// Deleting the demo template rests the whole edge-to-edge capability on ONE claim: "an
// interactive surface stays authorable as a `slot` block with `lane: "full"`". That claim is a
// CHAIN, and every link is load-bearing:
//
//   main.grid  >  article.article {grid-column: full}  >  figure[data-lane="full"]
//
// `grid-column` (and the grid's `[data-lane]` attribute contract) only place a DIRECT child of
// the grid. The old demo template had a `.demoBleed` wrapper precisely to own that placement;
// this branch deleted it, so the article itself must stay the page grid's direct child and the
// slot figure must stay the article's. Each link was unit-tested in isolation before this; the
// ASSEMBLED chain was not. These pin it.
//
// Measured in a real browser against the built app (Chrome, 1440px viewport, /feature-lens):
// with the chain intact a `data-lane="full"` figure inside the article renders at left=0,
// width=1429 — the full document width, i.e. true edge-to-edge. Interpose ONE wrapper element
// between <main> and <article> and the same figure collapses to left=379, width=672 (the prose
// measure). jsdom computes no grid, so these tests pin the STRUCTURE the browser measurement
// proved is sufficient.
describe("QA — the `full`-lane chain that replaces the demo canvas", () => {
  const ENTRY = {
    _id: "e-demo",
    title: "A Demo",
    slug: "demo-sample",
    kind: "demo",
    stage: null,
    tended: null,
    summary: "A summary.",
    theme: null,
    componentKey: null,
    themeSeed: null,
    body: [{ _type: "slot", _key: "s1", slotKey: "ghost", lane: "full" }],
    related: null,
    backlinks: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bodyHolder.node = null;
  });

  it("places a `full`-lane slot figure as a DIRECT child of the article grid, which is itself a DIRECT child of the page grid", async () => {
    // A REAL SlotBlock, awaited first (async RSC), then handed to the stubbed serializer —
    // so the figure and its `data-lane` stamp are the production component's own output.
    bodyHolder.node = await SlotBlock({ slotKey: "ghost", lane: "full" });
    fetchMock.mockResolvedValueOnce(ENTRY);

    const { default: EntryPage } = await import("./page");
    const { container } = render(
      await EntryPage({ params: Promise.resolve({ slug: "demo-sample" }) }),
    );

    const main = container.querySelector("main");
    const article = main?.querySelector("article");
    expect(article, "the entry mounts an <article>").not.toBeNull();
    // Link 1: nothing wraps the article — its `grid-column: full` is live.
    expect(
      article?.parentElement,
      "an interposed wrapper makes `.article { grid-column: full }` inert",
    ).toBe(main);
    // Link 2: the slot figure is the article grid's own direct child, so the grid's
    // `:where(.grid) > :where([data-lane="full"])` rule reaches it.
    const figure = container.querySelector('figure[data-lane="full"]');
    expect(figure, "the full-lane figure rendered").not.toBeNull();
    expect(
      figure?.parentElement,
      "a wrapper around the slot would strand it in the prose lane",
    ).toBe(article);
  });
});
