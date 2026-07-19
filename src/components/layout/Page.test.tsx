import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  declaredProperties,
  readModuleCss,
  ruleDeclarations,
} from "../../../tests/cssModule";

import gridStyles from "./ContentGrid.module.css";
import Page from "./Page";

describe("Page", () => {
  it("renders a <main> wrapping its children", () => {
    render(
      <Page data-testid="page">
        <span>a</span>
      </Page>,
    );
    const el = screen.getByTestId("page");
    expect(el.tagName).toBe("MAIN");
    expect(el).toContainElement(screen.getByText("a"));
  });

  it("IS the page's content grid (the ContentGrid class lands on the <main> itself)", () => {
    // The grid is the site's only width system: without this class every child loses its
    // lane and the page silently goes full-bleed unconstrained.
    render(<Page data-testid="page" />);
    expect(screen.getByTestId("page")).toHaveClass(gridStyles.grid);
  });

  it("is the skip-link target: renders id='main-content'", () => {
    render(<Page data-testid="page" />);
    expect(screen.getByTestId("page")).toHaveAttribute("id", "main-content");
  });

  it("carries tabIndex=-1 so the skip-link can move programmatic focus to it", () => {
    // The state boundaries (error/loading/not-found) delegate the whole skip-target contract to
    // Page — id AND focusability. A <main> is not focusable by default; without tabIndex=-1 the
    // skip-link scrolls but never moves focus (WCAG 2.4.1).
    render(<Page data-testid="page" />);
    const el = screen.getByTestId("page");
    expect(el).toHaveAttribute("tabindex", "-1");
    el.focus();
    expect(el).toHaveFocus();
  });

  it("merges a caller className alongside its own", () => {
    render(<Page className="caller" data-testid="page" />);
    const el = screen.getByTestId("page");
    expect(el).toHaveClass("caller");
    expect(el).toHaveClass(gridStyles.grid);
  });

  it("lets a caller override the id via passthrough (rest wins over the default)", () => {
    render(<Page id="custom" data-testid="page" />);
    expect(screen.getByTestId("page")).toHaveAttribute("id", "custom");
  });

  it("forwards native, aria, role and data-* attributes onto the element", () => {
    render(<Page data-testid="page" aria-label="content" data-foo="bar" />);
    const el = screen.getByTestId("page");
    expect(el).toHaveAttribute("aria-label", "content");
    expect(el).toHaveAttribute("data-foo", "bar");
  });

  it("forwards a ref to the underlying <main>", () => {
    const ref = createRef<HTMLElement>();
    render(<Page ref={ref} data-testid="page" />);
    expect(ref.current).toBe(screen.getByTestId("page"));
    expect(ref.current?.tagName).toBe("MAIN");
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    const { container } = render(<Page data-testid="page" />);
    expect(container.firstElementChild?.className).not.toContain("undefined");
    expect(
      container.firstElementChild?.className.trim().length,
    ).toBeGreaterThan(0);
  });
});

/**
 * The frame's block padding belongs to the Page primitive, not any one page. jsdom loads no
 * stylesheets, so the value can only be pinned at the source (postcss walks live declarations
 * only, so a commented-out rule can't keep these green).
 */
describe("Page.module.css — the frame's block padding", () => {
  const css = readModuleCss("src/components/layout/Page.module.css");
  const declarations = ruleDeclarations(css, ".page");

  it("frames every page with the gutter", () => {
    expect(declarations.get("padding-block")).toBe("var(--space-gutter)");
  });

  it("expresses the padding as the shorthand, never a start-only longhand", () => {
    // Route modules that own their own frame (`[slug]`'s demo template, the state screens)
    // override with the `padding-block` shorthand. Splitting this into a `padding-block-start`
    // longhand would leave those overrides half-applied — the lead-in would survive on a
    // full-bleed page that deliberately zeroes its padding.
    const properties = declaredProperties(css);
    expect(properties.has("padding-block")).toBe(true);
    expect(properties.has("padding-block-start")).toBe(false);
    expect(properties.has("padding-top")).toBe(false);
  });

  it("owns block padding only — inline sizing stays the content grid's", () => {
    // Page merges ContentGrid onto the same element; an inline-axis declaration here would be
    // this module quietly taking over the site's one width system.
    expect(declarations.size).toBe(1);
  });
});
