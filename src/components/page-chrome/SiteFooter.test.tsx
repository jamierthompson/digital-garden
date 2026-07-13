import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
