import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkError from "./error";

// The global `SkipLink` renders on the error view too; its `#main-content` anchor must resolve
// here. This frame renders `<main role="alert">` outside `Page`, so it needs the id itself
// (WCAG 2.4.1 — accessibility-and-performance.md §2).
describe("WorkError — skip-link target", () => {
  const error = Object.assign(new Error("boom"), { digest: "abc" });

  it("renders a single <main> landmark", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<WorkError error={error} unstable_retry={() => {}} />);
    // role="alert" is on the same element; query by the main landmark role explicitly.
    expect(document.querySelectorAll("main")).toHaveLength(1);
    spy.mockRestore();
  });

  it("carries id='main-content' so the global skip-link's target exists on the error view", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<WorkError error={error} unstable_retry={() => {}} />);
    expect(document.querySelector("main")).toHaveAttribute(
      "id",
      "main-content",
    );
    spy.mockRestore();
  });
});
