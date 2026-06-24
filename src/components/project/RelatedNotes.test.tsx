import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RelatedNotes from "./RelatedNotes";

// RelatedNotes is a synchronous, var-consuming component — it renders in jsdom. We assert
// the empty/null guard, one item per note, and the untitled fallback.
describe("RelatedNotes", () => {
  it("renders nothing when there are no related notes", () => {
    const { container: nullContainer } = render(<RelatedNotes notes={null} />);
    expect(nullContainer).toBeEmptyDOMElement();

    const { container: emptyContainer } = render(<RelatedNotes notes={[]} />);
    expect(emptyContainer).toBeEmptyDOMElement();
  });

  it("renders a labelled list with one item per note", () => {
    render(
      <RelatedNotes
        notes={[
          { _id: "n1", title: "On gardens" },
          { _id: "n2", title: "On OKLCH" },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /related notes/i }),
    ).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["On gardens", "On OKLCH"]);
  });

  it("falls back to a neutral label for an untitled note", () => {
    render(<RelatedNotes notes={[{ _id: "n3", title: null }]} />);
    expect(screen.getByText("Untitled note")).toBeInTheDocument();
  });
});
