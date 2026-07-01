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

  it("links to home (the logo), the Index, Now, and About", () => {
    render(<ShellNav />);
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/", "/browse", "/now", "/about"]),
    );
  });

  it("no longer exposes the folded /work and /notes indexes", () => {
    render(<ShellNav />);
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/work");
    expect(hrefs).not.toContain("/notes");
  });
});
