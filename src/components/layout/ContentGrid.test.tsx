import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ContentGrid from "./ContentGrid";
import styles from "./ContentGrid.module.css";

describe("ContentGrid", () => {
  it("renders a plain <div> wearing the grid class", () => {
    render(<ContentGrid data-testid="g">content</ContentGrid>);
    const el = screen.getByTestId("g");
    expect(el.tagName).toBe("DIV");
    expect(el).toHaveClass(styles.grid);
  });

  it("merges a caller className with no stray 'undefined' when className is omitted", () => {
    render(<ContentGrid data-testid="g" className="caller" />);
    expect(screen.getByTestId("g")).toHaveClass("caller");
    const { container } = render(<ContentGrid />);
    expect(container.firstElementChild?.className).not.toContain("undefined");
  });

  it("renders the child element itself under asChild, merging the class", () => {
    render(
      <ContentGrid asChild>
        <article aria-label="Essay">body</article>
      </ContentGrid>,
    );
    const article = screen.getByRole("article", { name: "Essay" });
    expect(article).toHaveClass(styles.grid);
  });

  it("forwards a ref to the underlying element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ContentGrid ref={ref} data-testid="g" />);
    expect(ref.current).toBe(screen.getByTestId("g"));
  });
});

/**
 * The primitive's contract is the column lanes ONLY — vertical rhythm, ink, and band styling stay
 * with the consumer. jsdom loads no CSS, so pin the boundary at the source: the lanes must exist,
 * and nothing else may creep in (it would silently apply everywhere the grid is used).
 */
describe("ContentGrid.module.css — the lanes, and nothing else", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/layout/ContentGrid.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("defines the three named lanes and the default prose column", () => {
    for (const line of [
      "full-start",
      "wide-start",
      "prose-start",
      "prose-end",
      "wide-end",
      "full-end",
    ]) {
      expect(css).toContain(`[${line}]`);
    }
    expect(css).toMatch(/grid-column:\s*prose/);
  });

  it("caps prose at the content measure, insets it by the gutter, and sizes wide off --width-wide", () => {
    expect(css).toMatch(/min\(\s*var\(--width-content\)/);
    expect(css).toMatch(/var\(--space-gutter\)/);
    expect(css).toMatch(/var\(--width-wide\)/);
  });

  it("maps the data-lane attribute contract to all three lanes at zero specificity", () => {
    for (const lane of ["prose", "wide", "full"]) {
      expect(css).toMatch(
        new RegExp(
          String.raw`:where\(\.grid\) > :where\(\[data-lane="${lane}"\]\)\s*\{\s*grid-column:\s*${lane}`,
        ),
      );
    }
  });

  it("declares no ink, band, or block-padding styling (lanes only)", () => {
    expect(css).not.toMatch(/color:/);
    expect(css).not.toMatch(/background/);
    expect(css).not.toMatch(/border/);
    expect(css).not.toMatch(/padding-block|padding-top|padding-bottom/);
  });
});
