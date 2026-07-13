import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RootLoading from "./loading";

describe("RootLoading — skip-link target", () => {
  it("renders a single <main> landmark", () => {
    render(<RootLoading />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("carries id='main-content' so the global skip-link's target exists while loading", () => {
    render(<RootLoading />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("carries tabIndex=-1 so the skip-link can move focus (delegated to Page, pinned here)", () => {
    render(<RootLoading />);
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("marks the loading region aria-busy", () => {
    render(<RootLoading />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });
});
