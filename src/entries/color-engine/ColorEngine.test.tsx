import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ColorEngine from "./ColorEngine";

// The rebuild-placeholder specimen renders the type roles through the Heading/Text primitives so
// a themed entry visibly demonstrates all three of its faces. The roles map to faces via
// semantic/type.css: display/subheading/label → --font-heading, lede/body → --font-body, meta →
// --font-mono. These assert every role is present (queried by role/accessible text), so the
// three-face showcase can't silently regress to a bare paragraph.
describe("ColorEngine (rebuild-placeholder type specimen)", () => {
  it("renders the display + subheading as real headings at their document levels", () => {
    render(<ColorEngine />);
    const display = screen.getByRole("heading", {
      level: 2,
      name: /being rebuilt/i,
    });
    const subheading = screen.getByRole("heading", {
      level: 3,
      name: /specimen of this entry/i,
    });
    // The heading face is driven by the variant, not the level.
    expect(display).toHaveAttribute("data-variant", "display");
    expect(subheading).toHaveAttribute("data-variant", "subheading");
  });

  it("covers all three faces: heading (label), body (lede + body), mono (meta)", () => {
    render(<ColorEngine />);
    // Heading face — the label kicker.
    expect(screen.getByText("Type specimen")).toHaveAttribute(
      "data-variant",
      "label",
    );
    // Body face — the lede intro and the running paragraph.
    expect(screen.getByText(/wears the entry.s theme/i)).toHaveAttribute(
      "data-variant",
      "lede",
    );
    expect(screen.getByText(/running copy like this/i)).toHaveAttribute(
      "data-variant",
      "body",
    );
    // Mono face — the meta line.
    expect(screen.getByText(/three roles, one entry theme/i)).toHaveAttribute(
      "data-variant",
      "meta",
    );
  });
});
