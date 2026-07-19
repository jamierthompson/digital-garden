import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import gridStyles from "@/components/layout/ContentGrid.module.css";

import {
  declaredCustomProperties,
  referencedCustomProperties,
} from "../../../tests/cssModule";

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

  it("mounts the logo inside the banner but OUTSIDE the primary nav", () => {
    // The a11y fix this structure exists for: nested inside `<nav>`, the logo is announced as
    // the first navigation item instead of banner-level site identity. Nothing visual changes
    // when it regresses, so the DOM relationship is the assertion.
    render(<SiteNav />);
    const logo = screen.getByRole("link", { name: "jamie thompson" });
    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(screen.getByRole("banner").contains(logo)).toBe(true);
    expect(nav.contains(logo)).toBe(false);
  });

  it("keeps the scheme toggle out of the primary nav too", () => {
    render(<SiteNav />);
    const toggle = screen.getByRole("switch", { name: /dark mode/i });
    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(nav.contains(toggle)).toBe(false);
    expect(screen.getByRole("banner").contains(toggle)).toBe(true);
  });

  it("puts the logo BEFORE the primary nav in DOM order (identity first, then wayfinding)", () => {
    // Containment alone can't catch a reorder: a logo moved after the nav still passes the
    // outside-the-nav test, but tab order (and the SR reading order) would lead with the menu.
    render(<SiteNav />);
    const logo = screen.getByRole("link", { name: "jamie thompson" });
    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(
      logo.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("the primary nav landmark owns exactly the five destinations, in IA order", () => {
    // The landmark must WRAP the links, not merely exist beside them — an empty <nav> plus
    // links floating outside it passes every contains-negative test above.
    render(<SiteNav />);
    const nav = screen.getByRole("navigation", { name: /primary/i });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/browse", "/system", "/about", "/now"]);
  });

  it("mounts the flower mark decorative and attribute-unsized (CSS owns its size)", () => {
    // The mark's contract with Logo: no role in the a11y tree (the link carries the name), no
    // width/height attributes (the module's --logo-size does the sizing), a SQUARE viewBox
    // (a non-square one letterboxes inside the square --logo-size box), and `currentColor`
    // fill so the state inks actually reach the petals. A decorative SVG has no accessible
    // handle by design, so this reaches for querySelector deliberately.
    render(<SiteNav />);
    expect(screen.queryByRole("img")).toBeNull();
    const logo = screen.getByRole("link", { name: "jamie thompson" });
    const svg = logo.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).not.toHaveAttribute("width");
    expect(svg).not.toHaveAttribute("height");
    expect(svg).toHaveAttribute("fill", "currentColor");
    const viewBox = (svg?.getAttribute("viewBox") ?? "").split(" ").map(Number);
    expect(viewBox).toHaveLength(4);
    expect(viewBox[2]).toBe(viewBox[3]);
  });

  it("aligns the header band to the shared content grid (ContentGrid's class lands on the <header> via asChild)", () => {
    render(<SiteNav />);
    // The composer's one layout responsibility: without this class the header row silently
    // goes full-bleed while the footer stays aligned — jsdom can't see the misalignment.
    expect(screen.getByRole("banner")).toHaveClass(gridStyles.grid);
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
      resolve(process.cwd(), `src/components/site-chrome/${name}`),
      "utf8",
    );
  const siteNavCss = read("SiteNav.module.css");
  const navLinksCss = read("NavLinks.module.css");

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

  it("the header row takes the wide lane of the band grid", () => {
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
});

/**
 * Component tokens are only real if they RESOLVE. A `var(--typo-d-name)` read is invalid at
 * computed-value time — the property silently falls to its initial value with no build error,
 * no lint failure, and no jsdom symptom, because jsdom computes no custom properties at all.
 * The chrome's tokens are declared on one rule (`.header`, `.links`, `.logo`) and consumed on
 * descendants, so a rename that misses a consumer, or a token declared on a NON-ancestor, is
 * invisible to every other test in this directory. These two scans are that net.
 */
describe("site-chrome component tokens resolve", () => {
  const CHROME_DIR = resolve(process.cwd(), "src/components/site-chrome");

  const cssFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return cssFiles(full);
      return entry.name.endsWith(".css") ? [full] : [];
    });

  const chromeModules = cssFiles(CHROME_DIR);

  // Everything the chrome may legitimately read from outside itself: the global token sheets
  // and the layout primitives it composes (Cluster's `--cluster-gap` channel, the grid lanes).
  const externalDeclared = new Set<string>(
    [
      ...cssFiles(resolve(process.cwd(), "src/styles")),
      ...cssFiles(resolve(process.cwd(), "src/components/layout")),
    ].flatMap((file) => [
      ...declaredCustomProperties(readFileSync(file, "utf8")),
    ]),
  );

  it("declares every chrome module non-empty (the scan is actually looking at something)", () => {
    // Guards the scans below against silently passing on an empty file list after a rename.
    expect(chromeModules.length).toBeGreaterThanOrEqual(6);
  });

  it.each(chromeModules.map((f) => [relative(CHROME_DIR, f), f]))(
    "%s reads no undeclared custom property",
    (_name, file) => {
      const css = readFileSync(file, "utf8");
      const declaredHere = declaredCustomProperties(css);
      const dangling = [...referencedCustomProperties(css)].filter(
        (token) => !declaredHere.has(token) && !externalDeclared.has(token),
      );
      expect(dangling).toEqual([]);
    },
  );

  it("leaves no orphaned component token behind (every one declared is read somewhere)", () => {
    // A token kept after its consumer was renamed is dead weight that reads as intent —
    // the next author wires to it and gets nothing.
    const allCss = [
      ...cssFiles(resolve(process.cwd(), "src/components")),
      ...cssFiles(resolve(process.cwd(), "src/app")),
    ]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const readAnywhere = referencedCustomProperties(allCss);

    const orphans: string[] = [];
    for (const file of chromeModules) {
      for (const token of declaredCustomProperties(
        readFileSync(file, "utf8"),
      )) {
        if (!readAnywhere.has(token)) {
          orphans.push(`${relative(CHROME_DIR, file)}: ${token}`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });
});
