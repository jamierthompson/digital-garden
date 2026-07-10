import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WorkLoading from "./loading";

// The `/[slug]` loading boundary renders `<main>` while the entry streams; the global `SkipLink`
// (#main-content) is on screen, so this fallback's landmark must carry the skip target
// (WCAG 2.4.1 — accessibility-and-performance.md, Focus & interaction). Renders outside `Page`.
describe("WorkLoading — skip-link target", () => {
  it("renders a single <main> landmark", () => {
    render(<WorkLoading />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("carries id='main-content' so the global skip-link's target exists while streaming", () => {
    render(<WorkLoading />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
