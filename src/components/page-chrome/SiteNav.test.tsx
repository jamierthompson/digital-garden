import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import gridStyles from "@/components/layout/ContentGrid.module.css";

import SiteNav from "./SiteNav";

// SiteNav mounts the `NavLinks` client leaf, which reads `usePathname`. Under Vitest there is
// no App Router context, so stub it to a stable path (home) for deterministic active state.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("SiteNav", () => {
  it("renders a labelled primary navigation", () => {
    render(<SiteNav />);
    expect(
      screen.getByRole("navigation", { name: /primary/i }),
    ).toBeInTheDocument();
  });

  it("links to home (the logo + featured), the Index, Now, About, and System", () => {
    render(<SiteNav />);
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    // The Index is labelled "index" but routes to `/browse` (a route named `index` collides
    // with the root `index.html` prerender — see NavLinks).
    expect(hrefs).toEqual(
      expect.arrayContaining(["/", "/browse", "/now", "/about", "/system"]),
    );
  });

  it("no longer exposes the folded /work or /notes indexes", () => {
    render(<SiteNav />);
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/work");
    expect(hrefs).not.toContain("/notes");
  });

  it("marks the active route with aria-current (home → featured)", () => {
    render(<SiteNav />);
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent(/featured/i);
  });

  it("renders the site tagline as a masthead band (not a heading — pages own their h1)", () => {
    render(<SiteNav />);
    expect(
      screen.getByText(/the design-engineering garden of jamie thompson/i),
    ).toBeInTheDocument();
    // It must NOT be a heading: the shell is on every page, so an h-element here would
    // collide with each page's own h1.
    expect(
      screen.queryByRole("heading", {
        name: /design-engineering garden/i,
      }),
    ).toBeNull();
  });

  it("keeps the byline a paragraph after the meta-role migration", () => {
    render(<SiteNav />);
    const byline = screen.getByText(
      /the design-engineering garden of jamie thompson/i,
    );
    expect(byline.tagName).toBe("P");
  });

  it("keeps the decorative dateline hidden from assistive tech (aria-hidden passthrough)", () => {
    render(<SiteNav />);
    const dateline = screen.getByText(/est\. 2026/i);
    expect(dateline).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading", { name: /est\. 2026/i })).toBeNull();
  });

  it("aligns the nav band to the shared content grid (ContentGrid's class lands on the <nav> via asChild)", () => {
    render(<SiteNav />);
    // The composer's one layout responsibility: without this class the nav row silently goes
    // full-bleed while the masthead and footer stay aligned — jsdom can't see the misalignment.
    expect(screen.getByRole("navigation", { name: /primary/i })).toHaveClass(
      gridStyles.grid,
    );
  });
});

/**
 * The header ink rule and the nav active-underline are BOTH the "thick" 2px border
 * (`--border-width-thick`). They must stay EQUAL and `.active` must override only the COLOR —
 * if `.active` re-declared the border width, or the placeholder and header widths diverged,
 * activating a link would shift the whole nav row by a pixel. The rules live in the pieces'
 * own modules; the invariant is CROSS-piece, so it's pinned here on the composer. (jsdom
 * performs no layout; this reads the source.)
 */
describe("SiteNav border-width-thick pair — no active-state layout shift", () => {
  const read = (name: string): string =>
    readFileSync(
      resolve(process.cwd(), `src/components/page-chrome/${name}`),
      "utf8",
    );
  const siteNavCss = read("SiteNav.module.css");
  const navLinksCss = read("NavLinks.module.css");
  const mastheadCss = read("Masthead.module.css");

  const rule = (css: string, selector: string): string => {
    const re = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`,
    );
    return css.match(re)?.[1] ?? "";
  };

  it("the header ink rule uses --border-width-thick", () => {
    expect(rule(siteNavCss, ".header")).toMatch(
      /border-bottom:\s*var\(--border-width-thick\)\s+solid/,
    );
  });

  it("the nav row takes the wide lane of the band grid", () => {
    // jsdom can't lay out the grid; pin the lane at the source. Without this the row falls to
    // the default prose lane and the chrome misaligns with the page content.
    expect(rule(siteNavCss, ".row")).toMatch(/grid-column:\s*wide/);
  });

  it("the .link underline placeholder reserves --border-width-thick (transparent)", () => {
    expect(rule(navLinksCss, ".link")).toMatch(
      /border-bottom:\s*var\(--border-width-thick\)\s+solid\s+transparent/,
    );
  });

  it("the .active rule overrides ONLY the color, never the border width", () => {
    const active = rule(navLinksCss, ".active");
    expect(active, "expected an .active rule").not.toBe("");
    expect(active).toMatch(/border-bottom-color:/);
    // The failure mode: if .active sets `border-bottom` or `border-bottom-width`, the reserved
    // placeholder width no longer governs and the row can shift on activation.
    expect(active).not.toMatch(/border-bottom-width:/);
    expect(active).not.toMatch(/border-bottom:\s*[^;]*\d/);
  });

  it("the masthead hairline stays the THIN (1px) width, distinct from the ink rule", () => {
    expect(rule(mastheadCss, ".masthead")).toMatch(
      /border-bottom:\s*var\(--border-width\)\s+solid/,
    );
  });
});
