import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
});

/**
 * Guards the nav link's ≥24px pointer target (WCAG 2.2 §2.5.8 Target Size (Minimum)).
 *
 * The bare `.link` text ran ~18px tall — below the 24px floor. The #38 fix gives it a real
 * hit area with `inline-flex` + `min-height`/`min-width` floors + vertical padding. jsdom
 * performs no layout, so a computed-size assertion is impossible here; this pins the
 * declarations that produce the floor at the source (same pragmatic approach as
 * `layout.test.ts`).
 *
 * Both axes are floored MECHANICALLY (`min-height` + `min-width`, not label-dependent), so a
 * future 1–2 char label still clears 24×24. Verifying the real rendered pixel box needs a
 * browser (no Playwright in-repo); the lead's chrome-devtools pass measured it live
 * (Index 39×40, Now 32×40, About 43×40).
 */
describe("SiteNav .link — WCAG 2.5.8 target size floor", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/page-chrome/SiteNav.module.css"),
    "utf8",
  );

  // Isolate the `.link { … }` rule body (not `.link:hover`).
  const linkRule = css.match(/\.link\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  // The floor snaps to `--size-control` (foundation/dimension.css). Resolve its rem value so
  // the guard still proves the box clears 24px, not merely that a token is referenced.
  const dimensionCss = readFileSync(
    resolve(process.cwd(), "src/styles/foundation/dimension.css"),
    "utf8",
  );
  const sizeControlRem = Number(
    dimensionCss.match(/--size-control:\s*([0-9.]+)rem/)?.[1],
  );

  it("finds the .link rule", () => {
    expect(linkRule, "expected a .link {…} rule in the module").not.toBe("");
  });

  it("uses a flex box so min-height + padding define the hit area", () => {
    expect(linkRule).toMatch(/display:\s*inline-flex/);
    expect(linkRule).toMatch(/align-items:\s*center/);
  });

  it("floors the height at 24px via --size-control", () => {
    expect(linkRule).toMatch(/min-height:\s*var\(--size-control\)/);
    // --size-control = 1.5rem = 24px at the 16px root — the 2.5.8 floor.
    expect(sizeControlRem).toBeGreaterThanOrEqual(1.5);
  });

  it("floors the width at 24px via --size-control", () => {
    expect(linkRule).toMatch(/min-width:\s*var\(--size-control\)/);
    // --size-control = 1.5rem = 24px — floors the WIDTH axis mechanically, not via label length.
    expect(sizeControlRem).toBeGreaterThanOrEqual(1.5);
    // centered so a label narrower than the floor sits centered in the 24px box.
    expect(linkRule).toMatch(/justify-content:\s*center/);
  });

  it("grows the pointer target with vertical padding", () => {
    // padding-block (top+bottom) enlarges the target beyond the text line box.
    expect(linkRule).toMatch(/padding-block:\s*var\(--space-2\)/);
  });
});

/**
 * The masthead ink rule and the nav active-underline are BOTH the "thick" 2px border
 * (`--border-width-thick`). They must stay EQUAL and `.active` must override only the COLOR —
 * if `.active` re-declared the border width, or the placeholder and heading widths diverged,
 * activating a link would shift the whole nav row by a pixel. (jsdom performs no layout; this
 * pins the declarations at the source.)
 */
describe("SiteNav border-width-thick pair — no active-state layout shift", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/page-chrome/SiteNav.module.css"),
    "utf8",
  );

  const rule = (selector: string): string => {
    const re = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`,
    );
    return css.match(re)?.[1] ?? "";
  };

  it("the masthead heading rule uses --border-width-thick", () => {
    expect(rule(".header")).toMatch(
      /border-bottom:\s*var\(--border-width-thick\)\s+solid/,
    );
  });

  it("the .link underline placeholder reserves --border-width-thick (transparent)", () => {
    expect(rule(".link")).toMatch(
      /border-bottom:\s*var\(--border-width-thick\)\s+solid\s+transparent/,
    );
  });

  it("the .active rule overrides ONLY the color, never the border width", () => {
    const active = rule(".active");
    expect(active, "expected an .active rule").not.toBe("");
    expect(active).toMatch(/border-bottom-color:/);
    // The failure mode: if .active sets `border-bottom` or `border-bottom-width`, the reserved
    // placeholder width no longer governs and the row can shift on activation.
    expect(active).not.toMatch(/border-bottom-width:/);
    expect(active).not.toMatch(/border-bottom:\s*[^;]*\d/);
  });

  it("the masthead hairline stays the THIN (1px) width, distinct from the ink rule", () => {
    expect(rule(".masthead")).toMatch(
      /border-bottom:\s*var\(--border-width\)\s+solid/,
    );
  });
});

/**
 * SiteNav's masthead reflows intrinsically: the byline/dateline row `flex-wrap`s, so the dateline
 * drops to its own line when the row is tight — no `@media` query. jsdom performs no layout, so
 * these read the source.
 */
describe("SiteNav masthead — intrinsic reflow", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/page-chrome/SiteNav.module.css"),
    "utf8",
  );

  const rule = (selector: string): string =>
    css.match(
      new RegExp(
        `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`,
      ),
    )?.[1] ?? "";

  it("reflows the masthead row with flex-wrap", () => {
    const masthead = rule(".mastheadInner");
    expect(masthead).toMatch(/display:\s*flex/);
    expect(masthead).toMatch(/flex-wrap:\s*wrap/);
  });

  it("uses no @media query", () => {
    expect(css).not.toMatch(/@media/);
  });

  it("references no @custom-media or --xs-down token", () => {
    // A `@media (--token)` custom-media query has no PostCSS substitution in this config, so it
    // would ship verbatim and silently never match.
    expect(css).not.toMatch(/@custom-media/);
    expect(css).not.toContain("--xs-down");
  });
});
