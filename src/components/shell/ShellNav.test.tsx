import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ShellNav from "./ShellNav";

// ShellNav is a synchronous, var-consuming server component — it renders in jsdom.
// We assert the primary nav is present and links to the real shell routes; we do NOT
// assert any `data-project` selector value here (that scope is applied by the layout,
// and "garden" registration lands during integration — see layout wiring).
describe("ShellNav", () => {
  it("renders a labelled primary navigation", () => {
    render(<ShellNav />);
    expect(
      screen.getByRole("navigation", { name: /primary/i }),
    ).toBeInTheDocument();
  });

  it("links to home, work, about, now, and notes", () => {
    render(<ShellNav />);
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/", "/work", "/about", "/now", "/notes"]),
    );
  });
});
