import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

// Home is a synchronous, var-consuming server component — renders in jsdom. We assert
// the shell content is present; we do NOT assert any `data-project` scope value here
// (the scope is applied by the layout, and "garden" registration lands at integration).
describe("Home page", () => {
  it("renders the site heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /digital garden/i }),
    ).toBeInTheDocument();
  });

  it("offers wayfinding links to the shell sections", () => {
    render(<Home />);
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/work", "/notes", "/about", "/now"]),
    );
  });
});
