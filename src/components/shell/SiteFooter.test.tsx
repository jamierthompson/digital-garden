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
      resolve(process.cwd(), "src/components/shell/SiteFooter.module.css"),
      "utf8",
    );
    expect(css).toMatch(/min-block-size:\s*var\(--size-control\)/);
  });
});
