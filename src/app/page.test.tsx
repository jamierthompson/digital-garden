import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Home is an async Server Component reading FEATURED_QUERY. Mock the single read path so a
// per-test fixture can be swapped; `vi.hoisted` lets the fixture + mock fn exist before the
// hoisted `vi.mock` factory runs. cardSwatches runs for REAL on each fixture's themeSeed —
// it's pure/defensive, so the null/garbage-seed cases exercise the true fallback path.
const { FEATURED_FIXTURE, fetchMock } = vi.hoisted(() => ({
  FEATURED_FIXTURE: [
    {
      _id: "1",
      title: "Color Engine",
      slug: "color-engine",
      kind: "demo",
      stage: "sketch",
      summary: "A seed in, a solved palette out.",
      themeSeed: "oklch(0.7 0.28 330)",
    },
    {
      _id: "2",
      title: "Feature Lens",
      slug: "feature-lens",
      kind: "demo",
      stage: "sketch",
      summary: "Looking inside a model.",
      themeSeed: "oklch(0.7 0.15 70)",
    },
  ],
  fetchMock: vi.fn(),
}));

vi.mock("@/sanity/lib/sanityFetch", () => ({ sanityFetch: fetchMock }));

// Home also pulls in `sitePageSeed.ts` (for the page's own theme seed), which imports
// `server-only` — it throws outside a react-server condition (vitest sets none). Neutralize it so
// the module loads; its real guard (failing a client-bundle import) is a build-time concern. The
// helper still calls the MOCKED `sanityFetch` above, so the real resolution logic is exercised.
vi.mock("server-only", () => ({}));

import { resolveThemeDeclarations } from "@/lib/theme";
import { SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";

import { readModuleCss, ruleDeclarations } from "../../tests/cssModule";

import Home from "./page";

const accentOf = (seed: unknown): string =>
  Object.fromEntries(resolveThemeDeclarations(seed))["--accent"];

// Each test starts from a clean mock (no leftover queued resolutions between suites).
beforeEach(() => {
  fetchMock.mockReset();
});

interface FeaturedRow {
  _id: string;
  title: string | null;
  slug: string | null;
  kind: string | null;
  stage: string | null;
  summary: string | null;
  themeSeed: unknown;
}

function row(over: Partial<FeaturedRow> & { _id: string }): FeaturedRow {
  return {
    title: "A card",
    slug: "a-card",
    kind: "demo",
    stage: "prototype",
    summary: null,
    themeSeed: "oklch(0.7 0.15 70)",
    ...over,
  };
}

// Home makes TWO cached reads — its `pageThemes.home` seed AND the featured list — so the mock is
// QUERY-AWARE, not call-order-based (a bare `mockResolvedValueOnce` would feed whichever read fires
// first). Each test names the `featured` rows it cares about; `settings` defaults to an unauthored
// home seed (the card assertions don't depend on the page theme).
function mockReads({
  featured = FEATURED_FIXTURE as unknown[],
  settings = { pageThemes: { home: null } } as unknown,
}: { featured?: unknown[]; settings?: unknown } = {}): void {
  fetchMock.mockImplementation((query: string) =>
    Promise.resolve(query === SITE_SETTINGS_QUERY ? settings : featured),
  );
}

describe("Home (featured front door)", () => {
  beforeEach(() => {
    mockReads();
  });

  it("renders the garden's invitation headline as the h1 (not the byline)", async () => {
    render(await Home());
    expect(
      screen.getByRole("heading", { level: 1, name: /building in the open/i }),
    ).toBeInTheDocument();
  });

  // The kicker is the superhead naming the site above the headline. It must be a real sibling
  // immediately before the h1 — plain document order would also pass with the kicker stranded in
  // another landmark — and it must NOT enter the outline (the h1 below is the page's one h1).
  it("keeps the kicker as the h1's immediately preceding sibling in the hero section", async () => {
    render(await Home());
    const kicker = screen.getByText(
      /the design-engineering garden of jamie thompson/i,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(kicker.tagName).toBe("P");
    expect(kicker.nextElementSibling).toBe(h1);
    expect(kicker.closest("section")).not.toBeNull();
    expect(kicker.closest("section")).toBe(h1.closest("section"));
  });

  it("wears the kicker type role and the muted ink, minting no heading", async () => {
    render(await Home());
    const kicker = screen.getByText(
      /the design-engineering garden of jamie thompson/i,
    );
    expect(kicker).toHaveAttribute("data-variant", "kicker");
    expect(kicker).toHaveAttribute("data-color", "muted-foreground");
    expect(
      screen.queryByRole("heading", { name: /design-engineering garden/i }),
    ).toBeNull();
  });

  // The headline carries no emphasis element. `em` is rendered in the heading face, which has no
  // true italic — the browser would synthesize a slant. Pinned as unstyled running text so the
  // treatment can't creep back in on a face that still can't honour it.
  it("renders the headline as plain running text, with no emphasis element", async () => {
    render(await Home());
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.querySelectorAll("em, i")).toHaveLength(0);
    expect(h1.textContent).toBe(
      "Notes, essays, and things I’m building in the open.",
    );
  });

  it("renders each featured entry as a card linking to its flat /[slug]", async () => {
    render(await Home());
    expect(
      screen.getByRole("heading", { name: /featured/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /color engine/i })).toHaveAttribute(
      "href",
      "/color-engine",
    );
    expect(screen.getByRole("link", { name: /feature lens/i })).toHaveAttribute(
      "href",
      "/feature-lens",
    );
  });

  // #175: the page delivers its OWN authored theme. Home resolves `pageThemes.home` and mounts
  // a synchronous `<PageTheme>`, baking the seed's engine-solved `--accent` into the parse-time
  // init script — in the render output, not deferred behind a boundary (the jsdom-visible half of
  // the streamed-shell guarantee; the prod-build/browser gate proves it lands in the static HTML).
  it("mounts PageTheme carrying the resolved pageThemes.home seed", async () => {
    const HOME_SEED = "#0ea5e9";
    mockReads({ settings: { pageThemes: { home: HOME_SEED } } });
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain(accentOf(HOME_SEED));
  });
});

describe("Home (/) — edges & boundaries", () => {
  it("omits the Featured section entirely when nothing is promoted", async () => {
    mockReads({ featured: [] });
    render(await Home());
    // The hero survives; no "Featured" section heading (visually-hidden or not) when empty.
    // (The onward "browse everything →" link now lives in the global SiteFooter, not Home.)
    expect(
      screen.getByRole("heading", { level: 1, name: /building in the open/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the design-engineering garden of jamie thompson/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /featured/i })).toBeNull();
  });

  it("brands a featured entry with a NULL themeSeed without throwing (fallback swatches)", async () => {
    // A null resolved seed means NOTHING in the chain is authored. The card
    // must still render (fallback palette), never crash the whole front door.
    mockReads({
      featured: [
        row({
          _id: "a",
          kind: "note",
          title: "Featured note",
          slug: "featured-note",
          themeSeed: null,
        }),
      ],
    });
    render(await Home());
    const link = screen.getByRole("link", { name: /featured note/i });
    expect(link).toHaveAttribute("href", "/featured-note");
    // The inline swatch overrides are present and baked (not thrown away).
    const card = link.closest("li");
    expect(card).not.toBeNull();
    expect(card!.getAttribute("style") ?? "").toContain("--surface");
  });

  it("survives a hostile/garbage themeSeed on a featured card", async () => {
    mockReads({
      featured: [
        row({
          _id: "a",
          title: "Garbage theme",
          slug: "g",
          themeSeed: "not-a-color",
        }),
      ],
    });
    render(await Home());
    expect(
      screen.getByRole("link", { name: /garbage theme/i }),
    ).toBeInTheDocument();
  });

  it("renders a slugless featured card as a non-link heading, never a dead link", async () => {
    mockReads({
      featured: [row({ _id: "a", title: "No route card", slug: null })],
    });
    render(await Home());
    expect(screen.queryByRole("link", { name: /no route card/i })).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: /no route card/i }),
    ).toBeInTheDocument();
  });

  it("falls back to a neutral label for an untitled featured card", async () => {
    mockReads({ featured: [row({ _id: "a", title: null, slug: "x" })] });
    render(await Home());
    expect(
      screen.getByRole("link", { name: /untitled entry/i }),
    ).toBeInTheDocument();
  });

  it("frames the page block with the lane alone — no block spacing in ANY form", () => {
    // The lead-in lives on the `Page` primitive; any block spacing re-added here — any spelling,
    // padding or margin, longhand or shorthand — gives the front door alone a double lead-in.
    // Pin the rule the way Page.module.css pins its own: `.content` owns the lane and nothing
    // else, so every spelling of block spacing fails here.
    const declarations = ruleDeclarations(
      readModuleCss("src/app/page.module.css"),
      ".content",
    );
    expect([...declarations.keys()]).toEqual(["grid-column"]);
  });

  it("sets the kicker→h1 gap to space(4), the superhead's own line", async () => {
    // The hero's gap is a designed value with no pin of its own: `Stack` writes it as the inline
    // `--stack-gap` custom property, so a silent revert to the old, too-tight space(2) renders
    // identically in jsdom and passes every other test in this file. Scope to the section that
    // owns the h1 — the featured block below it is a separate space(4) Stack.
    mockReads({ featured: [] });
    render(await Home());
    const hero = screen.getByRole("heading", { level: 1 }).closest("section");
    expect(hero).not.toBeNull();
    expect(hero?.style.getPropertyValue("--stack-gap")).toBe("var(--space-4)");
  });

  it("keeps a clean heading hierarchy: one h1, an h2 section, h3 card titles", async () => {
    mockReads({
      featured: [
        row({ _id: "a", title: "Card A", slug: "a" }),
        row({ _id: "b", title: "Card B", slug: "b" }),
      ],
    });
    render(await Home());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: /featured/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });
});
