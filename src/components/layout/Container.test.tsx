import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Container from "./Container";
import styles from "./Container.module.css";

describe("Container", () => {
  it("renders a plain <div> wearing the container class", () => {
    render(<Container data-testid="c">content</Container>);
    const el = screen.getByTestId("c");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass(styles.container);
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    render(<Container data-testid="c" className="caller" />);
    expect(screen.getByTestId("c")).toHaveClass("caller");
    const { container } = render(<Container />);
    expect(container.firstElementChild?.className).not.toContain("undefined");
  });

  it("renders the child element itself under asChild, merging the class", () => {
    render(
      <Container asChild>
        <nav aria-label="Primary">links</nav>
      </Container>,
    );
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveClass(styles.container);
  });

  it("forwards a ref to the underlying element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Container ref={ref} data-testid="c" />);
    expect(ref.current).toBe(screen.getByTestId("c"));
  });

  it("keeps a slotted child's own className alongside its class under asChild (neither clobbers)", () => {
    render(
      <Container asChild>
        <nav aria-label="Primary" className="own">
          links
        </nav>
      </Container>,
    );
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveClass("own");
    expect(nav).toHaveClass(styles.container);
  });

  it("routes a Container ref to the child under asChild without clobbering the child's own ref", () => {
    const containerRef = createRef<HTMLDivElement>();
    const childRef = createRef<HTMLElement>();
    render(
      <Container asChild ref={containerRef}>
        <nav ref={childRef} aria-label="Primary">
          links
        </nav>
      </Container>,
    );
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(containerRef.current).toBe(nav);
    expect(childRef.current).toBe(nav);
  });
});

/**
 * The primitive's contract is the page-column cap ONLY — ink, band styling (borders,
 * backgrounds), block padding, and flex behavior stay with the consumer. jsdom loads no CSS,
 * so pin the boundary at the source: a declaration creeping in here would silently apply to
 * every band in the chrome.
 */
describe("Container.module.css — single concern", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/layout/Container.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("declares no ink, band, block-padding, or flex styling", () => {
    expect(css).not.toMatch(/color:/);
    expect(css).not.toMatch(/background/);
    expect(css).not.toMatch(/border/);
    expect(css).not.toMatch(/padding-block|padding-top|padding-bottom/);
    expect(css).not.toMatch(/display:/);
  });

  it("declares the cap, centering, and gutter it exists for", () => {
    expect(css).toMatch(/max-width:\s*var\(--width-page\)/);
    expect(css).toMatch(/margin-inline:\s*auto/);
    expect(css).toMatch(/padding-inline:\s*var\(--space-gutter\)/);
  });
});
