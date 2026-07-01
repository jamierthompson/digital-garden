import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

// Home is a synchronous, var-consuming server component — renders in jsdom. We assert
// the shell content is present; we do NOT assert any `data-project` scope value here —
// chrome reads the global editorial semantic tier, and brand scope is confined to a
// project's own `<Experience/>` slot, never the shell.
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
      expect.arrayContaining(["/browse", "/about", "/now"]),
    );
  });
});
