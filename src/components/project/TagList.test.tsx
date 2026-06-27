import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TagList from "./TagList";

describe("TagList", () => {
  it("renders nothing when there are no tags", () => {
    const { container: nullContainer } = render(<TagList tags={null} />);
    expect(nullContainer).toBeEmptyDOMElement();

    const { container: emptyContainer } = render(<TagList tags={[]} />);
    expect(emptyContainer).toBeEmptyDOMElement();
  });

  it("renders one chip per tag under a labelled region", () => {
    render(<TagList tags={["portfolio", "oklch"]} />);
    const region = screen.getByRole("region", { name: /tags/i });
    expect(region).toBeInTheDocument();
    const chips = screen.getAllByRole("listitem");
    expect(chips.map((c) => c.textContent)).toEqual(["portfolio", "oklch"]);
  });
});
