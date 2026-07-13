import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryNotFound from "./not-found";

describe("EntryNotFound — skip-link target", () => {
  it("renders a single <main> landmark", () => {
    render(<EntryNotFound />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("carries id='main-content' so the global skip-link's target exists on the 404 view", () => {
    render(<EntryNotFound />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("carries tabIndex=-1 so the skip-link can move focus (delegated to Page, pinned here)", () => {
    render(<EntryNotFound />);
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("offers the way out: a real link back to home", () => {
    render(<EntryNotFound />);
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
