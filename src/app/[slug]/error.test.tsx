import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WorkError from "./error";

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

  it("carries tabIndex=-1 so the skip-link can move focus (delegated to Page, pinned here)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<WorkError error={error} unstable_retry={() => {}} />);
    expect(document.querySelector("main")).toHaveAttribute("tabindex", "-1");
    spy.mockRestore();
  });

  it("keeps role='alert' on the landmark so the failure is announced", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<WorkError error={error} unstable_retry={() => {}} />);
    expect(screen.getByRole("alert")).toBe(document.querySelector("main"));
    spy.mockRestore();
  });

  it("wires the retry button to unstable_retry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<WorkError error={error} unstable_retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("logs the thrown error for observability (digest correlation)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<WorkError error={error} unstable_retry={() => {}} />);
    expect(spy).toHaveBeenCalledWith(error);
    spy.mockRestore();
  });
});
