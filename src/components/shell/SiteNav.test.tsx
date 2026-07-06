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
    resolve(process.cwd(), "src/components/shell/SiteNav.module.css"),
    "utf8",
  );

  // Isolate the `.link { … }` rule body (not `.link:hover`).
  const linkRule = css.match(/\.link\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  it("finds the .link rule", () => {
    expect(linkRule, "expected a .link {…} rule in the module").not.toBe("");
  });

  it("uses a flex box so min-height + padding define the hit area", () => {
    expect(linkRule).toMatch(/display:\s*inline-flex/);
    expect(linkRule).toMatch(/align-items:\s*center/);
  });

  it("floors the height at 24px (min-height: 1.5rem)", () => {
    const minHeight = linkRule.match(/min-height:\s*([0-9.]+)rem/)?.[1];
    expect(minHeight, "expected a rem-based min-height").toBeDefined();
    // 1.5rem = 24px at the 16px root — the 2.5.8 floor.
    expect(Number(minHeight)).toBeGreaterThanOrEqual(1.5);
  });

  it("floors the width at 24px (min-width: 1.5rem)", () => {
    const minWidth = linkRule.match(/min-width:\s*([0-9.]+)rem/)?.[1];
    expect(minWidth, "expected a rem-based min-width").toBeDefined();
    // 1.5rem = 24px — floors the WIDTH axis mechanically, not via label length.
    expect(Number(minWidth)).toBeGreaterThanOrEqual(1.5);
    // centered so a label narrower than the floor sits centered in the 24px box.
    expect(linkRule).toMatch(/justify-content:\s*center/);
  });

  it("grows the pointer target with vertical padding", () => {
    // padding-block (top+bottom) enlarges the target beyond the text line box.
    expect(linkRule).toMatch(/padding-block:\s*var\(--space-2\)/);
  });
});
