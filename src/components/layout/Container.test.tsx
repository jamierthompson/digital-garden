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
});
