import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ShellNav from "./ShellNav";

// ShellNav mounts the `NavLinks` client leaf, which reads `usePathname`. Under Vitest there is
// no App Router context, so stub it to a stable path (home) for deterministic active state.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("ShellNav", () => {
  it("renders a labelled primary navigation", () => {
    render(<ShellNav />);
    expect(
      screen.getByRole("navigation", { name: /primary/i }),
    ).toBeInTheDocument();
  });

  it("links to home (the logo + featured), the Index, Now, About, and System", () => {
    render(<ShellNav />);
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
    render(<ShellNav />);
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/work");
    expect(hrefs).not.toContain("/notes");
  });

  it("marks the active route with aria-current (home → featured)", () => {
    render(<ShellNav />);
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent(/featured/i);
  });

  it("renders the site tagline as a masthead band (not a heading — pages own their h1)", () => {
    render(<ShellNav />);
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
