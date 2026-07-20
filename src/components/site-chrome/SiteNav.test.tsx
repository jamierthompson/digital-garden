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

  it("links to home (featured), the Index, Now, About, and System", () => {
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

  it("mounts the logo as a home link outside the primary nav", () => {
    render(<SiteNav />);
    const logo = screen.getByRole("link", { name: "jamie thompson" });
    expect(logo).toHaveAttribute("href", "/");
    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(nav.contains(logo)).toBe(false);
    expect(screen.getByRole("banner").contains(logo)).toBe(true);
  });

  it("keeps the scheme toggle out of the primary nav", () => {
    render(<SiteNav />);
    const toggle = screen.getByRole("button", { name: /switch to .* mode/i });
    const nav = screen.getByRole("navigation", { name: /primary/i });
    expect(nav.contains(toggle)).toBe(false);
    expect(screen.getByRole("banner").contains(toggle)).toBe(true);
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

  it("splits the row's two clusters — mark leading, controls hard-right", () => {
    // The row holds exactly two children (the logo and the controls cluster). Were the nav and
    // the toggle to escape that wrapper, space-between would spread three items across the band
    // instead of two. jsdom lays out nothing, so pin both halves at the source.
    expect(rule(siteNavCss, ".row")).toMatch(
      /justify-content:\s*space-between/,
    );
    expect(rule(siteNavCss, ".controls")).toMatch(
      /justify-content:\s*flex-end/,
    );
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

  // Set at RUNTIME by `react-remove-scroll-bar` (via Radix's dialog scroll lock), so it exists in
  // no stylesheet this scan can read. Every consumer must supply a fallback, since the package's
  // own source documents that it may be undefined.
  externalDeclared.add("--removed-body-scroll-bar-size");

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
