import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import VisuallyHidden from "./VisuallyHidden";

describe("VisuallyHidden", () => {
  it("renders its children (a span by default)", () => {
    render(<VisuallyHidden>Skip to content</VisuallyHidden>);
    expect(screen.getByText("Skip to content").tagName).toBe("SPAN");
  });

  it("renders as the requested element so semantics survive — a hidden heading stays a heading", () => {
    render(
      <VisuallyHidden as="h2" id="featured-heading">
        Featured
      </VisuallyHidden>,
    );
    // Visually hidden ≠ removed from the accessibility tree: the heading is still queryable
    // by role, which is exactly why it can serve as an `aria-labelledby` target.
    const heading = screen.getByRole("heading", { level: 2, name: "Featured" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute("id", "featured-heading");
  });

  it("does not use display:none (which would drop it from the a11y tree)", () => {
    render(<VisuallyHidden>Hidden but announced</VisuallyHidden>);
    // The clip technique is applied via a class, not inline display:none.
    expect(screen.getByText("Hidden but announced")).not.toHaveStyle({
      display: "none",
    });
  });
});
