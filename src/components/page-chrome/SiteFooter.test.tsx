import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import containerStyles from "@/components/layout/Container.module.css";
import colorStyles from "@/components/typography/textColor.module.css";

import SiteFooter from "./SiteFooter";

describe("SiteFooter", () => {
  it("renders a contentinfo landmark", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("shows the copyright byline with the current year", () => {
    render(<SiteFooter />);
    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`©\\s*${year}\\s+Jamie Thompson`)),
    ).toBeInTheDocument();
  });

  it("links onward to the browsable Index", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("link", { name: /browse everything/i }),
    ).toHaveAttribute("href", "/browse");
  });

  // The ≥24px tap-target floor (WCAG 2.2 SC 2.5.8, #127) lives in the CSS module: JSDOM
  // doesn't lay out or load CSS, so it can't measure the rendered box. Pin the declaration at
  // the source so the floor can't silently drop; the real ≥24×24 check is a browser QA pass.
  it("declares the ≥24px tap-target floor on footer links", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/components/page-chrome/SiteFooter.module.css",
      ),
      "utf8",
    );
    expect(css).toMatch(/min-block-size:\s*var\(--size-control\)/);
  });

  it("keeps the copyright + browse link inside contentinfo after the asChild merge", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    const year = new Date().getFullYear();
    expect(footer).toHaveTextContent(
      new RegExp(`©\\s*${year}\\s+Jamie Thompson`),
    );
    const link = screen.getByRole("link", { name: /browse everything/i });
    expect(footer).toContainElement(link);
  });

  it("merges the meta role onto the inner row (data-variant present, div preserved)", () => {
    render(<SiteFooter />);
    const row = screen
      .getByText(/© \d{4} Jamie Thompson/)
      .closest("[data-variant]");
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("data-variant", "meta");
    expect(row?.tagName).toBe("DIV");
  });

  it("caps the inner row to the page column (Container's class survives the double Slot chain)", () => {
    render(<SiteFooter />);
    // Container → Text → div is two nested asChild merges; if either layer drops className,
    // the footer row silently goes full-bleed while the nav above stays capped.
    const row = screen.getByText(/© \d{4} Jamie Thompson/).parentElement;
    expect(row).toHaveClass(containerStyles.container);
  });

  it("wears the muted ink via the Text color prop (rule + selector attribute both land)", () => {
    render(<SiteFooter />);
    // The ink moved from a module rule (color on .inner) to the color prop — the ink class
    // AND its data-color selector must both survive the Slot merges, or the colophon
    // silently renders in full-ink foreground.
    const row = screen.getByText(/© \d{4} Jamie Thompson/).parentElement;
    expect(row).toHaveClass(colorStyles.ink);
    expect(row).toHaveAttribute("data-color", "muted-foreground");
  });
});
