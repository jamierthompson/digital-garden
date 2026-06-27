import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ShellNav from "./ShellNav";

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
